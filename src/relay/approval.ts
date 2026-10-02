// Approval relay: carries a mobile-approval request to the paired apps and
// their reply back.

import type { CallOptions } from "../transport/transport.js";

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
