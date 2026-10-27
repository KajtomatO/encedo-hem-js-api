/**
 * The public client: one object per device.
 *
 * @packageDocumentation
 */
import { type AuthApi, AuthApiImpl } from './api/auth-api.js';
import { type BindingContext, noTokens } from './api/core.js';
import { ClockRecovery } from './auth/recovery.js';
import { Session, type TokenSource } from './auth/session.js';
import { type Clock, DEFAULT_TOKEN_LIFETIME_SECONDS, PassphraseLogin, validateLifetime } from './auth/login.js';
import { HemValidationError } from './errors.js';
import { type CryptoApi, CryptoApiImpl } from './api/crypto.js';
import { type KeysApi, KeysApiImpl } from './api/keymgmt.js';
import { type SystemApi, SystemApiImpl } from './api/system.js';
import { type ApprovalRelay, EncedoApprovalRelay } from './relay/approval.js';
import { type CheckinRelay, EncedoCheckinRelay } from './relay/checkin.js';
import { type FetchFunction, Transport } from './transport/transport.js';

/** Options of {@link HemClient}. */
export interface HemClientOptions {
  /**
   * Device URL, as a string or a `URL`: `https:` or `http:`, with a hostname
   * or an IP address, for example `https://my.ence.do` or
   * `https://192.168.7.1`. A path prefix is kept. There is no default.
   * Key-management and crypto operations need `https:`.
   */
  url: string | URL;
  /**
   * `fetch` used for every device request. Default: on Node.js the library's
   * own transport over `node:https` (Node's built-in `fetch` cannot talk to
   * the device, which matches header names case-sensitively), elsewhere
   * `globalThis.fetch`. TLS trust for the device certificate, proxies and
   * test doubles are configured here; on Node.js, `createNodeFetch` builds
   * one with custom trust.
   */
  fetch?: FetchFunction | undefined;
  /** Time limit of each device request in milliseconds; default 30 000. */
  timeoutMs?: number | undefined;
  /** Minimum time between the starts of consecutive device requests, in milliseconds; default 0. */
  minIntervalMs?: number | undefined;
  /**
   * Relay for check-in (`system.checkin` and clock recovery). Default: an
   * {@link EncedoCheckinRelay} posting to `https://api.encedo.com/checkin`
   * with the global `fetch`. Pass your own implementation to route it
   * elsewhere, or `null` to disable check-in.
   */
  checkinRelay?: CheckinRelay | null | undefined;
  /**
   * Relay for mobile approval. Default: an {@link EncedoApprovalRelay} for
   * the Encedo notification broker (`https://api.encedo.com/notify`) with the
   * global `fetch`. Pass your own implementation, or `null` to disable
   * mobile approval (the two device calls still work).
   */
  approvalRelay?: ApprovalRelay | null | undefined;
  /**
   * Passphrase for unattended login. It is used once, with the first login
   * challenge, to derive the login key (PBKDF2-HMAC-SHA256, 600 000
   * iterations, salted with the device's identity key); afterwards only the
   * derived, non-extractable key is kept in memory. Whether the session acts
   * as user or master is decided by the device from the passphrase.
   */
  passphrase?: string | undefined;
  /**
   * Mobile login mode, instead of a passphrase: every token the client needs
   * is obtained by asking the paired mobile apps to approve its scope,
   * through the approval relay. `true` uses the defaults (poll every 5 s,
   * wait up to 60 s). A client has either a passphrase or mobile mode, not
   * both.
   *
   * Observed with the real Encedo app: approved tokens lived 15 minutes
   * when https://github.com/KajtomatO/encedo-hem-c-api looked and 1 hour
   * on 2026-10-20; since crypto operations need a per-key scope
   * (`keymgmt:use:<kid>`), each key used means one push notification to
   * approve. The app shows a scope it does not know as unknown, with
   * nothing to reject, so such a wait always times out.
   */
  mobileApproval?: true | MobileApprovalOptions | undefined;
  /**
   * Requested lifetime of each token in seconds; default 28 800 (8 hours).
   * The largest value the device accepts is not documented.
   */
  tokenLifetimeSeconds?: number | undefined;
  /**
   * Repair the device clock automatically: when a login fails because the
   * device clock is unset (403 on the challenge) or has drifted by more than
   * 60 s (401 on the proof), run one check-in through the check-in relay and
   * log in once more. Default `true`; unavailable when `checkinRelay` is
   * `null`. A 401 without drift evidence is a wrong passphrase and never
   * triggers a check-in.
   */
  clockRecovery?: boolean | undefined;
  /** Clock in milliseconds since the Unix epoch; default `Date.now`. Meant for tests. */
  now?: Clock | undefined;
}

/** Settings of mobile login mode. */
export interface MobileApprovalOptions {
  /** How long to wait for each approval, in milliseconds; default 60 000. */
  timeoutMs?: number | undefined;
  /** Interval between checks for the outcome, in milliseconds; default 5 000. */
  intervalMs?: number | undefined;
  /** Note shown to the approver, 1 to 128 characters. */
  note?: string | undefined;
  /** Context copied into each request, 1 to 64 characters. */
  ctx?: string | undefined;
}

// Binding context of each client, for the library's own tests and internal
// helpers; not exported from the package root.
const contexts = new WeakMap<HemClient, BindingContext>();

/**
 * A relay option is `null` (disabled) or an object with the interface's
 * methods; anything else fails here, at construction, rather than at the
 * first check-in or approval.
 */
// implements: REQ-API-001
function checkRelay<T>(relay: T | null, parameter: string, methods: readonly string[]): T | null {
  if (relay === null) return null;
  const missing = methods.filter((method) => typeof (relay as Record<string, unknown> | undefined)?.[method] !== 'function');
  if (missing.length > 0) {
    throw new HemValidationError(`Invalid ${parameter}: must be null or implement ${methods.join(', ')} (missing: ${missing.join(', ')})`, { parameter });
  }
  return relay;
}

/** @internal The binding context of a client. */
export function contextOf(client: HemClient): BindingContext {
  const context = contexts.get(client);
  if (!context) throw new TypeError('Not a HemClient');
  return context;
}

/**
 * Client for one Encedo HEM device. Construction performs no I/O; all state
 * lives in the instance, and any number of clients may coexist.
 *
 * @since M1
 */
// implements: REQ-API-001
export class HemClient {
  /** Session: role and logout. */
  readonly auth: AuthApi;
  /** Device-wide calls: status, version, health, check-in. */
  readonly system: SystemApi;
  /** Key repository: create, get, list, search, delete. */
  readonly keys: KeysApi;
  /** Operations with stored keys: HMAC, wrap, unwrap. */
  readonly crypto: CryptoApi;

  constructor(options: HemClientOptions) {
    const transport = new Transport({
      url: options?.url,
      fetch: options?.fetch,
      timeoutMs: options?.timeoutMs,
      minIntervalMs: options?.minIntervalMs,
    });
    const now = options.now ?? ((): number => Date.now());
    const lifetime = options.tokenLifetimeSeconds === undefined ? DEFAULT_TOKEN_LIFETIME_SECONDS : validateLifetime(options.tokenLifetimeSeconds);
    if (options.passphrase !== undefined && (typeof options.passphrase !== 'string' || options.passphrase === '')) {
      throw new HemValidationError('Invalid passphrase: must be a non-empty string', { parameter: 'passphrase' });
    }
    // The login requests themselves are public operations and never go through the session.
    const publicContext: BindingContext = { transport, tokens: noTokens };
    const checkinRelay = options.checkinRelay === undefined ? new EncedoCheckinRelay() : checkRelay(options.checkinRelay, 'checkinRelay', ['exchange']);
    const recovery = new ClockRecovery(
      checkinRelay !== null && options.clockRecovery !== false ? (callOptions) => this.system.checkin(callOptions) : null,
    );
    if (options.passphrase !== undefined && options.mobileApproval !== undefined) {
      throw new HemValidationError('Invalid options: give either a passphrase or mobileApproval, not both', { parameter: 'mobileApproval' });
    }
    // Assigned below; the mobile token source only uses it once a call needs a token.
    let auth!: AuthApiImpl;
    let source: TokenSource | null = null;
    if (options.passphrase !== undefined) {
      source = new PassphraseLogin(publicContext, options.passphrase, lifetime, now, recovery);
    } else if (options.mobileApproval !== undefined) {
      // implements: REQ-AUTH-019 — every token comes from an approval of exactly the scope the operation needs.
      const mobile: MobileApprovalOptions = options.mobileApproval === true ? {} : options.mobileApproval;
      source = {
        acquire: async (scope) => ({
          token: await auth.engine.approve(scope, { note: mobile.note, ctx: mobile.ctx }, { timeoutMs: mobile.timeoutMs, intervalMs: mobile.intervalMs }),
          requestedExp: Number.POSITIVE_INFINITY,
        }),
        discard: () => undefined,
      };
    }
    const session = new Session(source, now);
    const context: BindingContext = { transport, tokens: session };
    const approvalRelay =
      options.approvalRelay === undefined ? new EncedoApprovalRelay() : checkRelay(options.approvalRelay, 'approvalRelay', ['getKey', 'submit', 'check']);
    auth = new AuthApiImpl(session, publicContext, recovery, approvalRelay, now);
    this.auth = auth;
    this.system = new SystemApiImpl(context, checkinRelay);
    this.keys = new KeysApiImpl(context);
    this.crypto = new CryptoApiImpl(context);
    contexts.set(this, context);
  }
}
