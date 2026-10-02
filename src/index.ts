// Public entry point of encedo-hem-js-api.
// implements: REQ-BUILD-002 — the package declares no dependencies; src/ imports only its own modules

export { HemClient } from "./client.js";
export type { HemClientOptions, MobileApprovalOptions } from "./client.js";
export { HEM_API_VERSION } from "./version.js";
export type { AuthApi, SessionInfo } from "./api/auth.js";
export type { LoginChallenge } from "./api/auth-calls.js";
export type { HemRole } from "./auth/token.js";
export type { SystemApi } from "./api/system.js";
export type { KeysApi } from "./api/keymgmt.js";
export type { CryptoApi } from "./api/crypto.js";
export type { CheckinRelay } from "./relay/checkin.js";
export type { ApprovalRelay, ApprovalRelayKey, ApprovalCheck } from "./relay/approval.js";
export type { CallOptions, FetchLike } from "./transport/transport.js";
export {
  HemError,
  HemBadRequestError,
  HemUnauthenticatedError,
  HemForbiddenError,
  HemOperationFailedError,
  HemDeviceStateError,
  HemOriginRejectedError,
  HemPayloadTooLargeError,
  HemTlsRequiredError,
  HemDeviceError,
  HemTimeoutError,
  HemUnreachableError,
  HemAbortError,
  HemValidationError,
  HemProtocolError,
  HemUnsupportedError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemRelayError,
} from "./errors.js";
export type { HemErrorCode, HemErrorOptions } from "./errors.js";
