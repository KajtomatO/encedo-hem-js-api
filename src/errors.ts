/**
 * Error classes of the library and the mapping of HTTP statuses onto them.
 *
 * Every failure of a public operation is an instance of {@link HemError}.
 * Error messages and properties carry only the operation name, the HTTP
 * status and the device's response body — never credentials or tokens.
 *
 * @packageDocumentation
 */

/** Stable, machine-readable identifier of an error class. */
export type HemErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'OPERATION_FAILED'
  | 'DEVICE_STATE'
  | 'ORIGIN_REJECTED'
  | 'PAYLOAD_TOO_LARGE'
  | 'TLS_REQUIRED'
  | 'DEVICE_ERROR'
  | 'TIMEOUT'
  | 'UNREACHABLE'
  | 'ABORTED'
  | 'VALIDATION'
  | 'PROTOCOL'
  | 'UNSUPPORTED'
  | 'APPROVAL_REJECTED'
  | 'APPROVAL_TIMEOUT';

/** Optional details attached to an error. */
export interface HemErrorOptions {
  /** HTTP status of the device response, when there was one. */
  status?: number;
  /** Name of the public operation that failed, for example `keys.create`. */
  operation?: string;
  /** Response body: parsed when it was JSON, otherwise the raw text. */
  body?: unknown;
  /** Response body exactly as received, when it was not empty. */
  bodyText?: string;
  /** The underlying error, if any. */
  cause?: unknown;
}

/**
 * Base class of every error the library raises.
 *
 * @since M1
 */
// implements: REQ-API-002
export class HemError extends Error {
  override name = 'HemError';
  /** Stable identifier of the error class. */
  readonly code: HemErrorCode;
  /** HTTP status of the device response; `undefined` when no response was received. */
  readonly status: number | undefined;
  /** Name of the public operation that failed. */
  readonly operation: string | undefined;
  /**
   * Response body: the parsed value when the body was JSON, the raw text
   * otherwise, `undefined` when the body was empty (the device's usual case).
   */
  readonly body: unknown;
  /** Response body exactly as received; `undefined` when it was empty. */
  readonly bodyText: string | undefined;

  constructor(code: HemErrorCode, message: string, options: HemErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.code = code;
    this.status = options.status;
    this.operation = options.operation;
    this.body = options.body;
    this.bodyText = options.bodyText;
  }

  /** Plain-object form, for structured logging. */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      status: this.status,
      operation: this.operation,
      body: this.body,
    };
  }
}

/** The device rejected the request as malformed (HTTP 400). @since M1 */
export class HemBadRequestError extends HemError {
  override name = 'HemBadRequestError';
  constructor(message: string, options?: HemErrorOptions) {
    super('BAD_REQUEST', message, options);
  }
}

/** The device refused the credentials or token (HTTP 401), also after one re-authentication. @since M1 */
export class HemUnauthenticatedError extends HemError {
  override name = 'HemUnauthenticatedError';
  constructor(message: string, options?: HemErrorOptions) {
    super('UNAUTHENTICATED', message, options);
  }
}

/** The token lacks the required scope or role, or the device clock is not set (HTTP 403). @since M1 */
export class HemForbiddenError extends HemError {
  override name = 'HemForbiddenError';
  constructor(message: string, options?: HemErrorOptions) {
    super('FORBIDDEN', message, options);
  }
}

/** The device refused or failed to perform the operation (HTTP 406). @since M1 */
export class HemOperationFailedError extends HemError {
  override name = 'HemOperationFailedError';
  constructor(message: string, options?: HemErrorOptions) {
    super('OPERATION_FAILED', message, options);
  }
}

/** The device is busy or in a state that does not allow the operation (HTTP 409). @since M1 */
export class HemDeviceStateError extends HemError {
  override name = 'HemDeviceStateError';
  constructor(message: string, options?: HemErrorOptions) {
    super('DEVICE_STATE', message, options);
  }
}

/** The device rejected the request's `Origin` (HTTP 412). @since M1 */
export class HemOriginRejectedError extends HemError {
  override name = 'HemOriginRejectedError';
  constructor(message: string, options?: HemErrorOptions) {
    super('ORIGIN_REJECTED', message, options);
  }
}

/** The request body exceeded the device's limit (HTTP 413). @since M1 */
export class HemPayloadTooLargeError extends HemError {
  override name = 'HemPayloadTooLargeError';
  constructor(message: string, options?: HemErrorOptions) {
    super('PAYLOAD_TOO_LARGE', message, options);
  }
}

/**
 * The operation needs HTTPS (HTTP 418), or a key-management or crypto call
 * was attempted over plain HTTP and refused before sending.
 *
 * @since M1
 */
export class HemTlsRequiredError extends HemError {
  override name = 'HemTlsRequiredError';
  constructor(message: string, options?: HemErrorOptions) {
    super('TLS_REQUIRED', message, options);
  }
}

/** The device reported an internal error (HTTP 500) or answered with any other unexpected status. @since M1 */
export class HemDeviceError extends HemError {
  override name = 'HemDeviceError';
  constructor(message: string, options?: HemErrorOptions) {
    super('DEVICE_ERROR', message, options);
  }
}

/** The call's time limit elapsed before the device answered. @since M1 */
export class HemTimeoutError extends HemError {
  override name = 'HemTimeoutError';
  constructor(message: string, options?: HemErrorOptions) {
    super('TIMEOUT', message, options);
  }
}

/** The device could not be reached: `fetch` rejected (connection, DNS, TLS). @since M1 */
export class HemUnreachableError extends HemError {
  override name = 'HemUnreachableError';
  constructor(message: string, options?: HemErrorOptions) {
    super('UNREACHABLE', message, options);
  }
}

/** The caller's `AbortSignal` fired. @since M1 */
export class HemAbortError extends HemError {
  override name = 'HemAbortError';
  constructor(message: string, options?: HemErrorOptions) {
    super('ABORTED', message, options);
  }
}

/** An input violates a documented limit; nothing was sent. @since M1 */
export class HemValidationError extends HemError {
  override name = 'HemValidationError';
  constructor(message: string, options?: HemErrorOptions) {
    super('VALIDATION', message, options);
  }
}

/** A success response is missing a required field or cannot be parsed. @since M1 */
export class HemProtocolError extends HemError {
  override name = 'HemProtocolError';
  constructor(message: string, options?: HemErrorOptions) {
    super('PROTOCOL', message, options);
  }
}

/** The operation does not exist on this hardware, or the runtime lacks a required capability. @since M1 */
export class HemUnsupportedError extends HemError {
  override name = 'HemUnsupportedError';
  constructor(message: string, options?: HemErrorOptions) {
    super('UNSUPPORTED', message, options);
  }
}

/** A mobile-app approval request was denied. @since M1 */
export class HemApprovalRejectedError extends HemError {
  override name = 'HemApprovalRejectedError';
  constructor(message: string, options?: HemErrorOptions) {
    super('APPROVAL_REJECTED', message, options);
  }
}

/** A mobile-app approval request was not answered in time. @since M1 */
export class HemApprovalTimeoutError extends HemError {
  override name = 'HemApprovalTimeoutError';
  constructor(message: string, options?: HemErrorOptions) {
    super('APPROVAL_TIMEOUT', message, options);
  }
}

type StatusErrorClass = new (message: string, options?: HemErrorOptions) => HemError;

// Status meanings from ref/api/hem-api-1.2.2.yaml.
const statusClasses: ReadonlyMap<number, readonly [StatusErrorClass, string]> = new Map([
  [400, [HemBadRequestError, 'bad request']],
  [401, [HemUnauthenticatedError, 'unauthenticated']],
  [403, [HemForbiddenError, 'forbidden']],
  [406, [HemOperationFailedError, 'operation refused or failed']],
  [409, [HemDeviceStateError, 'device busy or in the wrong state']],
  [412, [HemOriginRejectedError, 'origin rejected']],
  [413, [HemPayloadTooLargeError, 'payload too large']],
  [418, [HemTlsRequiredError, 'TLS required']],
  [500, [HemDeviceError, 'device error']],
]);

/**
 * Read an error response's body without ever failing: empty → nothing,
 * JSON → parsed value, anything else → the raw text.
 */
async function readErrorBody(response: Response): Promise<{ body?: unknown; bodyText?: string }> {
  let text: string;
  try {
    text = await response.text();
  } catch {
    return {};
  }
  if (text.trim() === '') return {};
  try {
    return { body: JSON.parse(text) as unknown, bodyText: text };
  } catch {
    return { body: text, bodyText: text };
  }
}

/**
 * Map a non-success device response to its error class. The status alone
 * decides the class; the body is attached when there is one, and is never
 * required to be present or well-formed.
 */
// implements: REQ-API-002, REQ-API-003
export async function errorFromResponse(response: Response, operation: string): Promise<HemError> {
  const { status } = response;
  const [ErrorClass, meaning] = statusClasses.get(status) ?? [HemDeviceError, 'unexpected status'];
  const body = await readErrorBody(response);
  return new ErrorClass(`${operation}: HTTP ${status} (${meaning})`, { status, operation, ...body });
}
