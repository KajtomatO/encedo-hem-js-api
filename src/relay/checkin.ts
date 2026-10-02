// Check-in relay: carries the device's check-in token to the vendor backend
// and the backend's reply back.

import type { CallOptions } from "../transport/transport.js";

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
