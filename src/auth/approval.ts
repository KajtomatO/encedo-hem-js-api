/**
 * The approval engine: begin, poll and wait for a mobile-app approval of a
 * scope, ending in exactly one of approved, rejected or timed out.
 *
 * @packageDocumentation
 */
import { base64ToBytes } from '../codec/base64.js';
import { utf8Decode } from '../codec/utf8.js';
import {
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemRelayError,
  HemTimeoutError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
} from '../errors.js';
import { type ApprovalRelay, isApprovalCheck } from '../relay/approval.js';
import { guardRelay, isString } from '../relay/http.js';
import { type CallOptions, MAX_TIMER_MS } from '../transport/transport.js';
import type { ClockRecovery } from './recovery.js';

/** Default interval between polls, in milliseconds. */
export const DEFAULT_POLL_INTERVAL_MS = 5_000;
/** Default time limit of a wait, in milliseconds. */
export const DEFAULT_APPROVAL_TIMEOUT_MS = 60_000;
/** The broker rejects an authorization request whose `iat` is ahead of its clock by more than this, in seconds. */
export const BROKER_FUTURE_SKEW_SECONDS = 2;
/** ... or behind it by more than this, in seconds. */
export const BROKER_PAST_SKEW_SECONDS = 15;

/** A submitted approval request. */
export interface PendingApproval {
  /** The scope the paired apps were asked to approve. */
  readonly scope: string;
  /** The relay's handle for checking the outcome. */
  readonly handle: string;
}

/** Context and note shown to the approver. */
export interface ApprovalDetails {
  /** Context copied into the request, 1 to 64 characters. */
  ctx?: string | undefined;
  /** Note shown to the approver, 1 to 128 characters. */
  note?: string | undefined;
}

/** Result of one poll. */
export type ApprovalPoll = { readonly status: 'pending' } | { readonly status: 'approved'; readonly token: string };

/** Options of a wait. */
export interface WaitOptions {
  signal?: AbortSignal | undefined;
  /** How long to wait for an outcome, in milliseconds; default 60 000. */
  timeoutMs?: number | undefined;
  /** Interval between polls, in milliseconds; default 5 000. */
  intervalMs?: number | undefined;
}

/** The device calls the engine uses. */
export interface ApprovalDeviceCalls {
  request(params: { epk: string; scope: string; ctx?: string | undefined; note?: string | undefined }, options: CallOptions): Promise<{ authreq: string; epk: string }>;
  redeem(authreply: string, options: CallOptions): Promise<string>;
}

/** The `iat` claim of a compact JWT, or `undefined` when it cannot be read. */
export function jwtIat(jwt: string): number | undefined {
  const payload = jwt.split('.')[1];
  if (payload === undefined || payload === '') return undefined;
  try {
    const claims = JSON.parse(utf8Decode(base64ToBytes(payload))) as { iat?: unknown };
    return typeof claims.iat === 'number' && Number.isFinite(claims.iat) ? claims.iat : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Whether the authorization request's `iat` shows the device clock too far
 * from local time for the broker: more than 2 s ahead or 15 s behind (from
 * https://github.com/KajtomatO/encedo-hem-c-api). No readable `iat` means no
 * evidence.
 */
export function brokerDrift(authreq: string, localNowMs: number): boolean {
  const iat = jwtIat(authreq);
  if (iat === undefined) return false;
  const drift = iat - localNowMs / 1000;
  return drift > BROKER_FUTURE_SKEW_SECONDS || drift < -BROKER_PAST_SKEW_SECONDS;
}

/** Failures of one poll that leave the wait running. */
function isTransient(error: unknown): boolean {
  if (error instanceof HemUnreachableError || error instanceof HemTimeoutError) return true;
  return error instanceof HemRelayError && (error.status === undefined || error.status >= 500);
}

function abortError(signal: AbortSignal): HemAbortError {
  return new HemAbortError('auth.waitForApproval: cancelled by the caller', { operation: 'auth.waitForApproval', cause: signal.reason });
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError(signal));
      return;
    }
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortError(signal as AbortSignal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function positive(value: number | undefined, fallback: number, parameter: string): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_TIMER_MS) {
    throw new HemValidationError(`Invalid ${parameter}: must be a positive number of milliseconds up to ${MAX_TIMER_MS}`, { parameter });
  }
  return value;
}

/** Runs mobile approvals through a relay. */
// implements: REQ-AUTH-018, REQ-AUTH-016
export class ApprovalEngine {
  readonly #relay: ApprovalRelay | null;
  readonly #device: ApprovalDeviceCalls;
  readonly #recovery: ClockRecovery;
  readonly #now: () => number;

  constructor(relay: ApprovalRelay | null, device: ApprovalDeviceCalls, recovery: ClockRecovery, now: () => number) {
    this.#relay = relay;
    this.#device = device;
    this.#recovery = recovery;
    this.#now = now;
  }

  #requireRelay(): ApprovalRelay {
    if (!this.#relay) throw new HemUnsupportedError('Mobile approval needs an approval relay; this client has none', { operation: 'auth.beginApproval' });
    return this.#relay;
  }

  /**
   * Obtain the relay key, ask the device for an authorization request and
   * submit it to the relay, in that order. When the broker refuses the
   * submit with 401 and the request's `iat` shows clock drift, one check-in
   * runs and the whole sequence is repeated once.
   */
  // implements: REQ-AUTH-020
  async begin(scope: string, details: ApprovalDetails = {}, options: CallOptions = {}): Promise<PendingApproval> {
    const relay = this.#requireRelay();
    const drifted = new WeakSet<object>();
    const attempt = async (): Promise<PendingApproval> => {
      const relayOptions = { signal: options.signal };
      const epk = await guardRelay('relay.approval.getKey', () => relay.getKey(relayOptions), isString);
      const request = await this.#device.request({ epk, scope, ctx: details.ctx, note: details.note }, options);
      try {
        const handle = await guardRelay('relay.approval.submit', () => relay.submit(request, relayOptions), isString);
        return { scope, handle };
      } catch (error) {
        if (error instanceof HemRelayError && error.status === 401 && brokerDrift(request.authreq, this.#now())) drifted.add(error);
        throw error;
      }
    };
    return this.#recovery.once(attempt, (error) => typeof error === 'object' && error !== null && drifted.has(error), options);
  }

  /**
   * Check once. Approved: the reply is redeemed through the device and the
   * token returned. Rejected raises `HemApprovalRejectedError` (nothing is
   * redeemed); expired raises `HemApprovalTimeoutError`.
   */
  async poll(pending: PendingApproval, options: CallOptions = {}): Promise<ApprovalPoll> {
    const relay = this.#requireRelay();
    const outcome = await guardRelay('relay.approval.check', () => relay.check(pending.handle, { signal: options.signal }), isApprovalCheck);
    switch (outcome.status) {
      case 'pending':
        return { status: 'pending' };
      case 'rejected':
        throw new HemApprovalRejectedError(`auth.approval: the request for scope "${pending.scope}" was rejected`, { operation: 'auth.pollApproval' });
      case 'expired':
        throw new HemApprovalTimeoutError(`auth.approval: the request for scope "${pending.scope}" expired`, { operation: 'auth.pollApproval' });
      case 'approved':
        return { status: 'approved', token: await this.#device.redeem(outcome.authreply, options) };
    }
  }

  /**
   * Poll at the interval until an outcome or the time limit, at least once.
   * A transport or relay failure of one poll does not end the wait (the last
   * one is the `cause` of the timeout error); the signal does.
   */
  async wait(pending: PendingApproval, options: WaitOptions = {}): Promise<string> {
    const limit = positive(options.timeoutMs, DEFAULT_APPROVAL_TIMEOUT_MS, 'timeoutMs');
    const interval = positive(options.intervalMs, DEFAULT_POLL_INTERVAL_MS, 'intervalMs');
    const deadline = Date.now() + limit;
    const { signal } = options;
    let lastFailure: unknown;
    for (;;) {
      if (signal?.aborted) throw abortError(signal);
      try {
        const result = await this.poll(pending, { signal });
        if (result.status === 'approved') return result.token;
      } catch (error) {
        if (!isTransient(error)) throw error;
        lastFailure = error;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new HemApprovalTimeoutError(`auth.approval: no answer for scope "${pending.scope}" within ${limit} ms`, {
          operation: 'auth.waitForApproval',
          ...(lastFailure === undefined ? {} : { cause: lastFailure }),
        });
      }
      await sleep(Math.min(interval, remaining), signal);
    }
  }

  /** Begin and wait: the token for `scope`. */
  async approve(scope: string, details: ApprovalDetails = {}, options: WaitOptions = {}): Promise<string> {
    const pending = await this.begin(scope, details, { signal: options.signal });
    return this.wait(pending, options);
  }
}

