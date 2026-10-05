/**
 * The public client: one object per device.
 *
 * @packageDocumentation
 */
import { AuthApi } from './api/auth-api.js';
import { type BindingContext, noTokens } from './api/core.js';
import { ClockRecovery } from './auth/recovery.js';
import { Session } from './auth/session.js';
import { type Clock, DEFAULT_TOKEN_LIFETIME_SECONDS, PassphraseLogin, validateLifetime } from './auth/login.js';
import { HemValidationError } from './errors.js';
import { CryptoApi } from './api/crypto.js';
import { KeysApi } from './api/keymgmt.js';
import { SystemApi } from './api/system.js';
import { type ApprovalRelay, EncedoApprovalRelay } from './relay/approval.js';
import { type CheckinRelay, EncedoCheckinRelay } from './relay/checkin.js';
import { type FetchFunction, Transport } from './transport/transport.js';

/** Options of {@link HemClient}. */
export interface HemClientOptions {
  /**
   * Device URL, `https:` or `http:`, with a hostname or an IP address, for
   * example `https://my.ence.do` or `https://192.168.7.1`. A path prefix is
   * kept. There is no default. Key-management and crypto operations need
   * `https:`.
   */
  url: string;
  /**
   * `fetch` used for every device request; defaults to `globalThis.fetch`.
   * TLS trust for the device certificate, proxies and test doubles are
   * configured here.
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

// Binding context of each client, for the library's own tests and internal
// helpers; not exported from the package root.
const contexts = new WeakMap<HemClient, BindingContext>();

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
  /** Key repository: create, get, list, search. */
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
    const checkinRelay = options.checkinRelay === undefined ? new EncedoCheckinRelay() : options.checkinRelay;
    const recovery = new ClockRecovery(
      checkinRelay !== null && options.clockRecovery !== false ? (callOptions) => this.system.checkin(callOptions) : null,
    );
    const source = options.passphrase === undefined ? null : new PassphraseLogin(publicContext, options.passphrase, lifetime, now, recovery);
    const session = new Session(source, now);
    const context: BindingContext = { transport, tokens: session };
    const approvalRelay = options.approvalRelay === undefined ? new EncedoApprovalRelay() : options.approvalRelay;
    this.auth = new AuthApi(session, publicContext, recovery, approvalRelay, now);
    this.system = new SystemApi(context, checkinRelay);
    this.keys = new KeysApi(context);
    this.crypto = new CryptoApi(context);
    contexts.set(this, context);
  }
}
