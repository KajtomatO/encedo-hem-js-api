// Public entry point of encedo-hem-js-api.
// implements: REQ-BUILD-002 — the package declares no dependencies; src/ imports only its own modules

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
