/**
 * Approval relay: carries a device authorization request to the paired
 * mobile apps and their reply back. Everything it carries is opaque to the
 * library.
 *
 * @packageDocumentation
 */
import { type FetchFunction, validateTimeout } from '../transport/transport.js';
import { type RelayCallOptions, relayFetch, relayRequest, relayStatusError, relayString } from './http.js';

/** Outcome of one check of a submitted authorization request. */
export type ApprovalCheck =
  | { readonly status: 'pending' }
  | { readonly status: 'approved'; readonly authreply: string }
  | { readonly status: 'rejected' }
  | { readonly status: 'expired' };

/** Whether a relay's `check` resolved with a well-formed {@link ApprovalCheck}. */
export function isApprovalCheck(value: unknown): value is ApprovalCheck {
  if (typeof value !== 'object' || value === null) return false;
  const { status, authreply } = value as { status?: unknown; authreply?: unknown };
  if (status === 'approved') return typeof authreply === 'string';
  return status === 'pending' || status === 'rejected' || status === 'expired';
}

/** A device authorization request as handed to the relay. */
export interface ApprovalSubmission {
  /** The device's authorization request (`authreq`). */
  readonly authreq: string;
  /** The key the request was made for (`epk`). */
  readonly epk: string;
}

/**
 * Carries mobile-approval traffic between the client and the paired apps.
 * Implement it to route approval through your own infrastructure; pass
 * `approvalRelay: null` to the client to disable approval.
 *
 * @since M1
 */
// implements: REQ-AUTH-016
export interface ApprovalRelay {
  /** The public key to use as `epk` in the device's authorization request (base64 of 32 bytes). */
  getKey(options?: RelayCallOptions): Promise<string>;
  /** Submit an authorization request; resolves with a handle for {@link ApprovalRelay.check}. */
  submit(submission: ApprovalSubmission, options?: RelayCallOptions): Promise<string>;
  /** Check once for the outcome of a submitted request. */
  check(handle: string, options?: RelayCallOptions): Promise<ApprovalCheck>;
}

/** Default broker base URL. */
export const ENCEDO_NOTIFY_URL = 'https://api.encedo.com/notify';

/** Options of {@link EncedoApprovalRelay}. */
export interface EncedoApprovalRelayOptions {
  /** Broker base URL; default `https://api.encedo.com/notify`. */
  url?: string | undefined;
  /** `fetch` for the broker; default `globalThis.fetch`. Never the device `fetch`. */
  fetch?: FetchFunction | undefined;
  /** Time limit of one broker call in milliseconds; default 30 000. */
  timeoutMs?: number | undefined;
}

/**
 * The default approval relay, for the Encedo notification broker. The
 * broker API is undocumented; these calls were reconstructed and confirmed
 * against the live broker by https://github.com/KajtomatO/encedo-hem-c-api
 * and can change without notice:
 *
 * | Operation | Broker call | Result |
 * |---|---|---|
 * | getKey | `GET /session` | `{epk, exp}` |
 * | submit | `POST /event/new` with `{authreq, epk}` | `{eventid, …}` |
 * | check | `GET /event/check/<eventid>` | 202 pending; 200 `{"deny":true}` rejected; 200 `{authreply, …}` approved; 404 unknown or expired |
 *
 * Any other status raises `HemRelayError` carrying the broker's status and
 * body. The broker learns the caller's IP address and shows its
 * geolocation on the phone.
 *
 * @since M1
 */
// implements: REQ-AUTH-017
export class EncedoApprovalRelay implements ApprovalRelay {
  readonly url: string;
  readonly #fetch: FetchFunction | undefined;
  readonly #timeoutMs: number | undefined;

  constructor(options: EncedoApprovalRelayOptions = {}) {
    this.url = (options.url ?? ENCEDO_NOTIFY_URL).replace(/\/+$/, '');
    this.#fetch = options.fetch;
    this.#timeoutMs = options.timeoutMs === undefined ? undefined : validateTimeout(options.timeoutMs);
  }

  async getKey(options?: RelayCallOptions): Promise<string> {
    const operation = 'relay.approval.getKey';
    const response = await relayRequest(relayFetch(this.#fetch, operation), operation, `${this.url}/session`, { method: 'GET' }, this.#timeoutMs, options);
    if (response.status < 200 || response.status > 299) throw relayStatusError(operation, response);
    return relayString(operation, response, 'epk');
  }

  async submit(submission: ApprovalSubmission, options?: RelayCallOptions): Promise<string> {
    const operation = 'relay.approval.submit';
    const response = await relayRequest(
      relayFetch(this.#fetch, operation),
      operation,
      `${this.url}/event/new`,
      { method: 'POST', body: { authreq: submission.authreq, epk: submission.epk } },
      this.#timeoutMs,
      options,
    );
    if (response.status < 200 || response.status > 299) throw relayStatusError(operation, response);
    return relayString(operation, response, 'eventid');
  }

  async check(handle: string, options?: RelayCallOptions): Promise<ApprovalCheck> {
    const operation = 'relay.approval.check';
    const url = `${this.url}/event/check/${encodeURIComponent(handle)}`;
    const response = await relayRequest(relayFetch(this.#fetch, operation), operation, url, { method: 'GET' }, this.#timeoutMs, options);
    if (response.status === 202) return { status: 'pending' };
    if (response.status === 404) return { status: 'expired' };
    if (response.status === 200) {
      const reply = response.json as Record<string, unknown> | undefined;
      if (reply?.['deny'] === true) return { status: 'rejected' };
      if (typeof reply?.['authreply'] === 'string') return { status: 'approved', authreply: reply['authreply'] };
    }
    throw relayStatusError(operation, response);
  }
}
