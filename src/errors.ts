// Error classes and the mapping from HTTP responses to them.
// implements: REQ-API-002, REQ-API-003

/** Stable machine-readable error codes, one per error class. */
export type HemErrorCode =
  | "HEM_ERROR"
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "OPERATION_FAILED"
  | "DEVICE_STATE"
  | "ORIGIN_REJECTED"
  | "PAYLOAD_TOO_LARGE"
  | "TLS_REQUIRED"
  | "DEVICE_ERROR"
  | "TIMEOUT"
  | "UNREACHABLE"
  | "ABORTED"
  | "VALIDATION"
  | "PROTOCOL"
  | "UNSUPPORTED"
  | "APPROVAL_REJECTED"
  | "APPROVAL_TIMEOUT"
  | "RELAY";

/** Details attached to an error when it is created. */
export interface HemErrorOptions {
  /** HTTP status of the response that caused the error, when there was one. */
  status?: number;
  /** Name of the library operation that failed, e.g. `keys.create`. */
  operation?: string;
  /** Raw response body text, when the response had one. */
  body?: string;
  /** The underlying error. */
  cause?: unknown;
}

/**
 * Base class of every error raised by the library.
 *
 * `code` is stable across releases and identifies the class. `status` is the
 * HTTP status when a response was received. `body` holds the raw response
 * text and `json` its parsed form when it parses; the device normally sends
 * error responses with an empty body.
 */
export class HemError extends Error {
  /** Stable code identifying the error class. */
  readonly code: HemErrorCode = "HEM_ERROR";
  /** HTTP status of the response, when there was one. */
  readonly status: number | undefined;
  /** The library operation that failed, e.g. `crypto.wrap`. */
  operation: string | undefined;
  /** Raw response body text; `undefined` when there was no response or it was empty. */
  readonly body: string | undefined;
  /** The response body parsed as JSON, when it is valid JSON. */
  readonly json: unknown;

  constructor(message: string, options: HemErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.status = options.status;
    this.operation = options.operation;
    this.body = options.body === "" ? undefined : options.body;
    this.json = parseJsonOrUndefined(this.body);
  }

  /** A plain representation for logging; it never contains request data. */
  toJSON(): Record<string, unknown> {
    const out: Record<string, unknown> = { name: this.name, code: this.code, message: this.message };
    if (this.status !== undefined) out["status"] = this.status;
    if (this.operation !== undefined) out["operation"] = this.operation;
    if (this.body !== undefined) out["body"] = this.body;
    return out;
  }
}

/** The device answered 400: the request was malformed. */
export class HemBadRequestError extends HemError {
  override readonly code = "BAD_REQUEST";
}

/** The device answered 401, and one re-authentication did not help. */
export class HemUnauthenticatedError extends HemError {
  override readonly code = "UNAUTHENTICATED";
}

/** The device answered 403: the token's scope or role does not permit the operation, or the clock is not set. */
export class HemForbiddenError extends HemError {
  override readonly code = "FORBIDDEN";
}

/** The device answered 406: the operation was refused or failed (for example, key not found). */
export class HemOperationFailedError extends HemError {
  override readonly code = "OPERATION_FAILED";
}

/** The device answered 409: it is busy or in the wrong state (not initialised, self-test fault latched). */
export class HemDeviceStateError extends HemError {
  override readonly code = "DEVICE_STATE";
}

/** The device answered 412: the request's `Origin` is not on the device's allow-list. */
export class HemOriginRejectedError extends HemError {
  override readonly code = "ORIGIN_REJECTED";
}

/** The device answered 413: the request body exceeded its limit. */
export class HemPayloadTooLargeError extends HemError {
  override readonly code = "PAYLOAD_TOO_LARGE";
}

/** TLS is required: the device answered 418, or a key-management or crypto call was attempted over plain HTTP. */
export class HemTlsRequiredError extends HemError {
  override readonly code = "TLS_REQUIRED";
}

/** The device answered 500 or another status the library does not expect. */
export class HemDeviceError extends HemError {
  override readonly code = "DEVICE_ERROR";
}

/** The call's time limit elapsed before a complete response arrived. */
export class HemTimeoutError extends HemError {
  override readonly code = "TIMEOUT";
}

/** `fetch` rejected: the device could not be reached (connection, DNS or TLS failure). */
export class HemUnreachableError extends HemError {
  override readonly code = "UNREACHABLE";
}

/** The caller's `AbortSignal` fired before the call completed. */
export class HemAbortError extends HemError {
  override readonly code = "ABORTED";
}

/** An input violates a documented limit; nothing was sent. */
export class HemValidationError extends HemError {
  override readonly code = "VALIDATION";
  /** Name of the offending parameter. */
  readonly parameter: string;

  constructor(parameter: string, message: string, options: HemErrorOptions = {}) {
    super(`${parameter}: ${message}`, options);
    this.parameter = parameter;
  }

  override toJSON(): Record<string, unknown> {
    return { ...super.toJSON(), parameter: this.parameter };
  }
}

/** A success response lacks a required field or cannot be parsed. */
export class HemProtocolError extends HemError {
  override readonly code = "PROTOCOL";
}

/** The operation does not exist on this hardware, or the runtime or configuration lacks a required capability. */
export class HemUnsupportedError extends HemError {
  override readonly code = "UNSUPPORTED";
}

/** A mobile approval request was denied on the phone. */
export class HemApprovalRejectedError extends HemError {
  override readonly code = "APPROVAL_REJECTED";
}

/** A mobile approval request was not answered in time, or the relay reported it expired. */
export class HemApprovalTimeoutError extends HemError {
  override readonly code = "APPROVAL_TIMEOUT";
}

/** A cloud relay (check-in backend or approval broker) answered with an unexpected status. */
export class HemRelayError extends HemError {
  override readonly code = "RELAY";
}

type HemErrorClass = new (message: string, options?: HemErrorOptions) => HemError;

const STATUS_CLASSES: Readonly<Record<number, HemErrorClass>> = {
  400: HemBadRequestError,
  401: HemUnauthenticatedError,
  403: HemForbiddenError,
  406: HemOperationFailedError,
  409: HemDeviceStateError,
  412: HemOriginRejectedError,
  413: HemPayloadTooLargeError,
  418: HemTlsRequiredError,
  500: HemDeviceError,
};

const STATUS_TEXT: Readonly<Record<number, string>> = {
  400: "bad request",
  401: "unauthenticated",
  403: "forbidden",
  406: "operation refused or failed",
  409: "device busy or in the wrong state",
  412: "origin rejected by the device's allow-list",
  413: "payload too large",
  418: "TLS required",
  500: "device error",
};

/**
 * Maps an HTTP error status to its error class. The body is optional and is
 * never parsed to decide the class.
 */
export function errorFromStatus(status: number, operation?: string, body?: string): HemError {
  const Cls = STATUS_CLASSES[status] ?? HemDeviceError;
  const text = STATUS_TEXT[status] ?? "unexpected status";
  const options: HemErrorOptions = { status };
  if (operation !== undefined) options.operation = operation;
  if (body !== undefined) options.body = body;
  return new Cls(`${operation ?? "request"}: HTTP ${status} (${text})`, options);
}

function parseJsonOrUndefined(text: string | undefined): unknown {
  if (text === undefined || text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
