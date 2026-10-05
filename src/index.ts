/**
 * Public entry point of the Encedo HEM client.
 *
 * @packageDocumentation
 */

/**
 * Version of the HEM REST API this library is written against.
 *
 * Compare it with the firmware version reported by the device to decide
 * whether the two are compatible.
 *
 * @since M1
 */
// implements: REQ-API-010
export const HEM_API_VERSION = '1.2.2';

export {
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemBadRequestError,
  HemDeviceError,
  HemDeviceStateError,
  HemError,
  HemForbiddenError,
  HemOperationFailedError,
  HemOriginRejectedError,
  HemPayloadTooLargeError,
  HemProtocolError,
  HemRelayError,
  HemTimeoutError,
  HemTlsRequiredError,
  HemUnauthenticatedError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
} from './errors.js';
export type { HemErrorCode, HemErrorOptions } from './errors.js';

export { HemClient } from './client.js';
export type { AuthApi } from './api/auth-api.js';
export type { Role } from './auth/session.js';
export type { HemClientOptions } from './client.js';
export type { CheckinResult, HealthReport, SystemApi, SystemStatus, SystemVersion } from './api/system.js';
export { EncedoCheckinRelay, ENCEDO_CHECKIN_URL } from './relay/checkin.js';
export type { CheckinRelay, EncedoCheckinRelayOptions } from './relay/checkin.js';
export type { RelayCallOptions } from './relay/http.js';
export type { CallOptions, FetchFunction } from './transport/transport.js';
