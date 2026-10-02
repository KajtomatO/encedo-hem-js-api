// The public client: one object per device.
// implements: REQ-API-001

import { AuthApiImpl, type AuthApi } from "./api/auth.js";
import { CryptoApiImpl, type CryptoApi } from "./api/crypto.js";
import { KeysApiImpl, type KeysApi } from "./api/keymgmt.js";
import { SystemApiImpl, type SystemApi } from "./api/system.js";
import { DEFAULT_TOKEN_LIFETIME_SECONDS, Session } from "./auth/session.js";
import { validateInteger } from "./codec/validate.js";
import { HemValidationError } from "./errors.js";
import type { ClientContext } from "./internal/context.js";
import { EncedoApprovalRelay, type ApprovalRelay } from "./relay/approval.js";
import { EncedoCheckinRelay, type CheckinRelay } from "./relay/checkin.js";
import { Transport, type FetchLike } from "./transport/transport.js";

/** Settings of mobile-approval login mode. */
export interface MobileApprovalOptions {
  /** Interval between checks for an answer, in milliseconds (default 5000). */
  pollIntervalMs?: number | undefined;
  /** How long to wait for an answer, in milliseconds (default 60 000). */
  waitTimeoutMs?: number | undefined;
  /** Context string copied into the authorization request (1 to 64 characters). */
  ctx?: string | undefined;
  /** Note shown on the phone (1 to 128 characters). */
  note?: string | undefined;
}

/** Options of {@link HemClient}. Only `url` is required. */
export interface HemClientOptions {
  /**
   * Device URL, for example `https://my.ence.do` or `https://192.168.7.1`.
   * `http:` works for status, version, check-in and login; key-management and
   * crypto operations require `https:`. A path prefix is kept.
   */
  url: string | URL;
  /**
   * `fetch` used for every device request (the global `fetch` when omitted).
   * TLS trust, proxies and test doubles are configured through it.
   */
  fetch?: FetchLike | undefined;
  /** Time limit of each device request, in milliseconds (default 30 000). */
  timeoutMs?: number | undefined;
  /** Minimum interval between the starts of consecutive device requests, in milliseconds (default 0). */
  minRequestIntervalMs?: number | undefined;
  /** Requested lifetime of bearer tokens, in seconds (default 28 800, i.e. 8 hours). */
  tokenLifetimeSeconds?: number | undefined;
  /**
   * The user's (or master's) passphrase. It is used once to derive the login
   * key and is not retained. Exclusive with `mobileApproval`.
   */
  passphrase?: string | undefined;
  /**
   * Obtain every token through approval on a paired mobile app instead of a
   * passphrase. Exclusive with `passphrase`.
   */
  mobileApproval?: boolean | MobileApprovalOptions | undefined;
  /** Run one check-in and retry when a login fails because the device clock is wrong (default true). */
  clockRecovery?: boolean | undefined;
  /** Check-in relay; the Encedo backend relay when omitted, none when `null`. */
  checkinRelay?: CheckinRelay | null | undefined;
  /** Approval relay; the Encedo broker relay when omitted, none when `null`. */
  approvalRelay?: ApprovalRelay | null | undefined;
}

/**
 * Client for one Encedo HEM device. Construction performs no I/O; all state
 * (tokens, credential, request queue) belongs to the instance.
 */
export class HemClient {
  /** Login, session and mobile approval. */
  readonly auth: AuthApi;
  /** Device status, version, health and check-in. */
  readonly system: SystemApi;
  /** Key management. */
  readonly keys: KeysApi;
  /** Cryptographic operations with stored keys. */
  readonly crypto: CryptoApi;

  constructor(options: HemClientOptions) {
    if (options === null || typeof options !== "object") {
      throw new HemValidationError("options", "an options object with the device URL is required");
    }
    const transport = new Transport({
      url: options.url,
      fetch: options.fetch,
      timeoutMs: options.timeoutMs,
      minIntervalMs: options.minRequestIntervalMs,
    });
    const lifetimeSeconds =
      options.tokenLifetimeSeconds === undefined
        ? DEFAULT_TOKEN_LIFETIME_SECONDS
        : validateInteger(options.tokenLifetimeSeconds, "tokenLifetimeSeconds", 1);
    if (options.passphrase !== undefined && typeof options.passphrase !== "string") {
      throw new HemValidationError("passphrase", "must be a string");
    }
    const checkinRelay =
      options.checkinRelay === undefined ? new EncedoCheckinRelay() : checkRelay(options.checkinRelay, "checkinRelay", ["exchange"]);
    const approvalRelay =
      options.approvalRelay === undefined
        ? new EncedoApprovalRelay()
        : checkRelay(options.approvalRelay, "approvalRelay", ["obtainKey", "submit", "check"]);
    const ctx = { transport, checkinRelay, approvalRelay } as ClientContext;
    ctx.session = new Session(ctx, {
      passphrase: options.passphrase,
      lifetimeSeconds,
      clockRecovery: options.clockRecovery,
    });
    this.auth = new AuthApiImpl(ctx);
    this.system = new SystemApiImpl(ctx);
    this.keys = new KeysApiImpl(ctx);
    this.crypto = new CryptoApiImpl(ctx);
  }
}

function checkRelay<T>(relay: T | null, parameter: string, methods: string[]): T | null {
  if (relay === null) return null;
  for (const m of methods) {
    if (typeof (relay as Record<string, unknown> | undefined)?.[m] !== "function") {
      throw new HemValidationError(parameter, `must implement ${methods.join(", ")} or be null`);
    }
  }
  return relay;
}
