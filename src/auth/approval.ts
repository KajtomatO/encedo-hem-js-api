// Approval engine: begin, poll and wait for mobile approval of a scope.
// implements: REQ-AUTH-018, REQ-AUTH-019, REQ-AUTH-020, REQ-AUTH-016

import { validateInteger } from "../codec/validate.js";
import {
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemRelayError,
  HemTimeoutError,
  HemUnreachableError,
  HemUnsupportedError,
} from "../errors.js";
import { extRequest, extToken } from "../api/ext-calls.js";
import { callOptions, type ClientContext } from "../internal/context.js";
import { validateScope } from "../internal/scope.js";
import type { ApprovalRelay } from "../relay/approval.js";
import type { CallOptions } from "../transport/transport.js";
import { nowSeconds, type TokenEntry } from "./session.js";
import { decodeJwtClaims } from "./token.js";

/** Default interval between checks for an answer [C-SDK]. */
export const DEFAULT_APPROVAL_POLL_MS = 5_000;
/** Default time to wait for an answer [C-SDK]. */
export const DEFAULT_APPROVAL_WAIT_MS = 60_000;
/** The broker rejects an `iat` more than this many seconds ahead of its clock [C-SDK]. */
export const BROKER_IAT_FUTURE_SKEW_SECONDS = 2;
/** …or more than this many seconds behind it [C-SDK]. */
export const BROKER_IAT_PAST_SKEW_SECONDS = 15;

/** A submitted approval request. */
export interface ApprovalAttempt {
  /** The scope the token will carry once approved. */
  readonly scope: string;
  /** The relay's id for the request. */
  readonly id: string;
  /** The device's authorization request (opaque). */
  readonly authreq: string;
  /** The relay key used as `epk`. */
  readonly epk: string;
}

/** Options of `beginApproval`. */
export interface ApprovalRequestOptions extends CallOptions {
  /** Context copied into the request, 1 to 64 characters. */
  ctx?: string | undefined;
  /** Note shown on the phone, 1 to 128 characters. */
  note?: string | undefined;
}

/** Options of `waitForApproval`. */
export interface ApprovalWaitOptions extends CallOptions {
  /** Interval between checks, in milliseconds (default 5000). */
  pollIntervalMs?: number | undefined;
  /** How long to wait for an answer, in milliseconds (default 60 000). */
  waitTimeoutMs?: number | undefined;
}

export interface ApprovalDefaults {
  pollIntervalMs: number;
  waitTimeoutMs: number;
  ctx: string | undefined;
  note: string | undefined;
}

/** True when the authorization request's `iat` is outside what the broker accepts. */
export function brokerDriftEvident(authreq: string, now = nowSeconds()): boolean {
  const iat = decodeJwtClaims(authreq)?.iat;
  if (iat === undefined) return false;
  const drift = iat - now;
  return drift > BROKER_IAT_FUTURE_SKEW_SECONDS || drift < -BROKER_IAT_PAST_SKEW_SECONDS;
}

export class ApprovalEngine {
  readonly #ctx: ClientContext;
  readonly defaults: ApprovalDefaults;

  constructor(ctx: ClientContext, defaults: { [K in keyof ApprovalDefaults]?: ApprovalDefaults[K] | undefined } = {}) {
    this.#ctx = ctx;
    this.defaults = {
      pollIntervalMs:
        defaults.pollIntervalMs === undefined ? DEFAULT_APPROVAL_POLL_MS : validateInteger(defaults.pollIntervalMs, "pollIntervalMs", 1),
      waitTimeoutMs:
        defaults.waitTimeoutMs === undefined ? DEFAULT_APPROVAL_WAIT_MS : validateInteger(defaults.waitTimeoutMs, "waitTimeoutMs", 0),
      ctx: defaults.ctx,
      note: defaults.note,
    };
  }

  #relay(operation: string): ApprovalRelay {
    const relay = this.#ctx.approvalRelay;
    if (!relay) throw new HemUnsupportedError(`${operation}: no approval relay is configured`, { operation });
    return relay;
  }

  /**
   * Obtains the relay key, asks the device for an authorization request and
   * submits it. A broker 401 with drift evidence runs one check-in and
   * submits a fresh request, at most once.
   */
  async begin(scope: string, options: ApprovalRequestOptions = {}): Promise<ApprovalAttempt> {
    const s = validateScope(scope, "scope", 1023);
    const relay = this.#relay("auth.beginApproval");
    const call = callOptions(options);
    const ctx = options.ctx ?? this.defaults.ctx;
    const note = options.note ?? this.defaults.note;
    const { epk } = await relay.obtainKey(call);
    let recovered = false;
    for (;;) {
      const req = await extRequest(this.#ctx, { epk, scope: s, ctx, note }, call);
      try {
        const id = await relay.submit(req, call);
        return { scope: s, id, authreq: req.authreq, epk: req.epk };
      } catch (e) {
        const drift = e instanceof HemRelayError && e.status === 401 && brokerDriftEvident(req.authreq);
        if (!drift || recovered) throw e;
        recovered = true;
        await this.#ctx.session.recoverClock(e, call);
      }
    }
  }

  /**
   * Checks once. Approved: redeems the reply (the token is cached under the
   * attempt's scope). Rejected: `HemApprovalRejectedError`. Expired:
   * `HemApprovalTimeoutError`.
   */
  async poll(attempt: ApprovalAttempt, options: CallOptions = {}): Promise<"pending" | TokenEntry> {
    const relay = this.#relay("auth.pollApproval");
    const answer = await relay.check(attempt.id, callOptions(options));
    switch (answer.state) {
      case "pending":
        return "pending";
      case "rejected":
        throw new HemApprovalRejectedError(`approval of "${attempt.scope}" was rejected on the phone`, { operation: "auth.pollApproval" });
      case "expired":
        throw new HemApprovalTimeoutError(`approval request for "${attempt.scope}" expired`, { operation: "auth.pollApproval" });
      case "approved":
        return extToken(this.#ctx, { authreply: answer.authreply, scope: attempt.scope }, callOptions(options));
      default:
        throw new HemRelayError("auth.pollApproval: the relay returned an unknown state", { operation: "auth.pollApproval" });
    }
  }

  /** Polls until an outcome or the wait limit; at least one poll. Transport errors in one poll do not end the wait. */
  async wait(attempt: ApprovalAttempt, options: ApprovalWaitOptions = {}): Promise<TokenEntry> {
    const interval =
      options.pollIntervalMs === undefined ? this.defaults.pollIntervalMs : validateInteger(options.pollIntervalMs, "pollIntervalMs", 1);
    const limit =
      options.waitTimeoutMs === undefined ? this.defaults.waitTimeoutMs : validateInteger(options.waitTimeoutMs, "waitTimeoutMs", 0);
    const deadline = Date.now() + limit;
    const call = callOptions(options);
    let lastError: unknown;
    for (;;) {
      if (call.signal?.aborted) throw new HemAbortError("auth.waitForApproval: aborted by the caller", { cause: call.signal.reason });
      try {
        const r = await this.poll(attempt, call);
        if (r !== "pending") return r;
      } catch (e) {
        if (!(e instanceof HemUnreachableError || e instanceof HemTimeoutError)) throw e;
        lastError = e;
      }
      if (Date.now() + interval > deadline) {
        throw new HemApprovalTimeoutError(`no answer to the approval request for "${attempt.scope}" within ${limit} ms`, {
          operation: "auth.waitForApproval",
          cause: lastError,
        });
      }
      await sleep(interval, call.signal);
    }
  }

  async approve(scope: string, options: ApprovalRequestOptions & ApprovalWaitOptions = {}): Promise<TokenEntry> {
    return this.wait(await this.begin(scope, options), options);
  }
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new HemAbortError("auth.waitForApproval: aborted by the caller", { cause: signal?.reason }));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
