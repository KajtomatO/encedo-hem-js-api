/**
 * Check-in relay: carries the device's check-in token to the Encedo backend
 * and its reply back. Both values are opaque to the library.
 *
 * @packageDocumentation
 */
import { type FetchFunction, validateTimeout } from '../transport/transport.js';
import { type RelayCallOptions, relayFetch, relayRequest, relayStatusError, relayString } from './http.js';

/**
 * Carries a check-in token from the device to a check-in backend and returns
 * the backend's reply. Implement it to route check-in through your own
 * infrastructure; pass `checkinRelay: null` to the client to disable check-in.
 *
 * @since M1
 */
export interface CheckinRelay {
  /** Send the device's `check` token; resolve with the backend's `checked` reply. */
  exchange(check: string, options?: RelayCallOptions): Promise<string>;
}

/** Default check-in backend URL. */
export const ENCEDO_CHECKIN_URL = 'https://api.encedo.com/checkin';

/** Options of {@link EncedoCheckinRelay}. */
export interface EncedoCheckinRelayOptions {
  /** Backend URL; default `https://api.encedo.com/checkin`. */
  url?: string | undefined;
  /**
   * `fetch` for the backend; default `globalThis.fetch`. Never the device
   * `fetch`, so relaxed device TLS settings are not used against the cloud.
   */
  fetch?: FetchFunction | undefined;
  /** Time limit of one exchange in milliseconds; default 30 000. */
  timeoutMs?: number | undefined;
}

/**
 * The default check-in relay: `POST {check}` to the Encedo backend, which
 * answers `{checked}`; unauthenticated (from
 * https://github.com/KajtomatO/encedo-hem-c-api). Failures raise
 * `HemRelayError` with the backend's status and body.
 *
 * @since M1
 */
// implements: REQ-SYS-006
export class EncedoCheckinRelay implements CheckinRelay {
  readonly url: string;
  readonly #fetch: FetchFunction | undefined;
  readonly #timeoutMs: number | undefined;

  constructor(options: EncedoCheckinRelayOptions = {}) {
    this.url = options.url ?? ENCEDO_CHECKIN_URL;
    this.#fetch = options.fetch;
    this.#timeoutMs = options.timeoutMs === undefined ? undefined : validateTimeout(options.timeoutMs);
  }

  async exchange(check: string, options?: RelayCallOptions): Promise<string> {
    const operation = 'relay.checkin';
    const response = await relayRequest(relayFetch(this.#fetch, operation), operation, this.url, { method: 'POST', body: { check } }, this.#timeoutMs, options);
    if (response.status !== 200) throw relayStatusError(operation, response);
    return relayString(operation, response, 'checked');
  }
}
