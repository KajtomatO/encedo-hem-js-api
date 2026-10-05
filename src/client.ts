/**
 * The public client: one object per device.
 *
 * @packageDocumentation
 */
import { type BindingContext, type TokenProvider, noTokens } from './api/core.js';
import { type Clock, DEFAULT_TOKEN_LIFETIME_SECONDS, PassphraseLogin, validateLifetime } from './auth/login.js';
import { HemValidationError } from './errors.js';
import { SystemApi } from './api/system.js';
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
  /** Device-wide calls: status, version, health, check-in. */
  readonly system: SystemApi;

  constructor(options: HemClientOptions) {
    const transport = new Transport({
      url: options?.url,
      fetch: options?.fetch,
      timeoutMs: options?.timeoutMs,
      minIntervalMs: options?.minIntervalMs,
    });
    const now = options.now ?? Date.now;
    const lifetime = options.tokenLifetimeSeconds === undefined ? DEFAULT_TOKEN_LIFETIME_SECONDS : validateLifetime(options.tokenLifetimeSeconds);
    let tokens: TokenProvider = noTokens;
    const context: BindingContext = { transport, get tokens() { return tokens; } };
    if (options.passphrase !== undefined) {
      if (typeof options.passphrase !== 'string' || options.passphrase === '') {
        throw new HemValidationError('Invalid passphrase: must be a non-empty string', { parameter: 'passphrase' });
      }
      const login = new PassphraseLogin(context, options.passphrase, lifetime, now);
      tokens = {
        async withToken(scope, callOptions, send) {
          const { token } = await login.acquire(scope, callOptions);
          return send(token);
        },
      };
    }
    const checkinRelay = options.checkinRelay === undefined ? new EncedoCheckinRelay() : options.checkinRelay;
    this.system = new SystemApi(context, checkinRelay);
    contexts.set(this, context);
  }
}
