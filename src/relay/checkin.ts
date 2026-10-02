// Check-in relay: carries the device's check-in token to the vendor backend
// and the backend's reply back.
// implements: REQ-SYS-006

import type { CallOptions } from "../transport/transport.js";
import { RelayHttp, relayJson, relayStatusError, relayString, type RelayHttpOptions } from "./http.js";

/**
 * Carries a check-in exchange between the device and the check-in backend.
 * The strings are opaque; an implementation must not alter them.
 */
export interface CheckinRelay {
  /**
   * Sends the device's `check` token to the backend and returns the
   * backend's `checked` reply.
   */
  exchange(check: string, options?: CallOptions): Promise<string>;
}

/** Default check-in backend [C-SDK]. */
export const ENCEDO_CHECKIN_URL = "https://api.encedo.com/checkin";

export interface EncedoCheckinRelayOptions extends RelayHttpOptions {
  /** Backend URL (default `https://api.encedo.com/checkin`). */
  url?: string | undefined;
}

/**
 * The default check-in relay: `POST <url>` with `{check}`, answered by
 * `{checked}`. Uses its own `fetch`, never the device's.
 */
export class EncedoCheckinRelay implements CheckinRelay {
  readonly url: string;
  readonly #http: RelayHttp;

  constructor(options: EncedoCheckinRelayOptions = {}) {
    this.url = options.url ?? ENCEDO_CHECKIN_URL;
    this.#http = new RelayHttp(options);
  }

  async exchange(check: string, options?: CallOptions): Promise<string> {
    const operation = "checkinRelay.exchange";
    const res = await this.#http.request(operation, "POST", this.url, { check }, options);
    if (res.status !== 200) throw relayStatusError(operation, res);
    return relayString(operation, relayJson(operation, res), "checked");
  }
}
