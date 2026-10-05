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
export type { HemClientOptions } from './client.js';
export type { SystemStatus, SystemVersion, SystemApi } from './api/system.js';
export type { CallOptions, FetchFunction } from './transport/transport.js';
