// Approval relay: carries a mobile-approval request to the paired apps and
// their reply back.
// implements: REQ-AUTH-016, REQ-AUTH-017

import type { CallOptions } from "../transport/transport.js";
import { RelayHttp, relayJson, relayStatusError, relayString, type RelayHttpOptions } from "./http.js";

/** The relay's public key, used as `epk` in the device's authorization request. */
export interface ApprovalRelayKey {
  /** Standard base64 of a 32-byte X25519 public key. */
  epk: string;
  /** Expiry of the key in Unix seconds, when the relay reports one. */
  exp?: number | undefined;
}

/** Outcome of one check of a submitted request. */
export type ApprovalCheck =
  | { readonly state: "pending" }
  | { readonly state: "approved"; readonly authreply: string }
  | { readonly state: "rejected" }
  | { readonly state: "expired" };

/**
 * Carries an authorization request from the device to the paired mobile
 * apps and their reply back. Everything it carries is opaque.
 */
export interface ApprovalRelay {
  /** Obtains the key to send to the device as `epk`. */
  obtainKey(options?: CallOptions): Promise<ApprovalRelayKey>;
  /** Submits the device's authorization request; returns an id to check it by. */
  submit(request: { authreq: string; epk: string }, options?: CallOptions): Promise<string>;
  /** Checks a submitted request once. */
  check(id: string, options?: CallOptions): Promise<ApprovalCheck>;
}

/** Default notification broker [C-SDK]. */
export const ENCEDO_NOTIFY_URL = "https://api.encedo.com/notify";

export interface EncedoApprovalRelayOptions extends RelayHttpOptions {
  /** Broker base URL (default `https://api.encedo.com/notify`). */
  url?: string | undefined;
}

/**
 * The default approval relay for the Encedo notification broker:
 * `GET /session` → `{epk, exp}`; `POST /event/new` with `{authreq, epk}` →
 * `{eventid}`; `GET /event/check/<eventid>` → 202 pending, 200 `{deny}`
 * rejected, 200 `{authreply}` approved, 404 expired. The broker API is
 * undocumented and was reconstructed by the C SDK; it can change without
 * notice. Uses its own `fetch`, never the device's.
 */
export class EncedoApprovalRelay implements ApprovalRelay {
  readonly url: string;
  readonly #http: RelayHttp;

  constructor(options: EncedoApprovalRelayOptions = {}) {
    this.url = (options.url ?? ENCEDO_NOTIFY_URL).replace(/\/+$/, "");
    this.#http = new RelayHttp(options);
  }

  async obtainKey(options?: CallOptions): Promise<ApprovalRelayKey> {
    const operation = "approvalRelay.obtainKey";
    const res = await this.#http.request(operation, "GET", `${this.url}/session`, undefined, options);
    if (res.status !== 200) throw relayStatusError(operation, res);
    const o = relayJson(operation, res);
    const exp = o["exp"];
    return { epk: relayString(operation, o, "epk"), exp: typeof exp === "number" ? exp : undefined };
  }

  async submit(request: { authreq: string; epk: string }, options?: CallOptions): Promise<string> {
    const operation = "approvalRelay.submit";
    const body = { authreq: request.authreq, epk: request.epk };
    const res = await this.#http.request(operation, "POST", `${this.url}/event/new`, body, options);
    if (res.status !== 200) throw relayStatusError(operation, res);
    return relayString(operation, relayJson(operation, res), "eventid");
  }

  async check(id: string, options?: CallOptions): Promise<ApprovalCheck> {
    const operation = "approvalRelay.check";
    const res = await this.#http.request(operation, "GET", `${this.url}/event/check/${encodeURIComponent(id)}`, undefined, options);
    if (res.status === 202) return { state: "pending" };
    if (res.status === 404) return { state: "expired" };
    if (res.status !== 200) throw relayStatusError(operation, res);
    const o = relayJson(operation, res);
    if ("deny" in o) return { state: "rejected" };
    return { state: "approved", authreply: relayString(operation, o, "authreply") };
  }
}
