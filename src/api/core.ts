/**
 * The binding core shared by every API group: an operation is described as
 * data, and one pipeline validates, serialises, sends, parses tolerantly and
 * maps errors.
 *
 * @packageDocumentation
 */
import { base64ToBytes, hexToBytes } from '../codec/base64.js';
import { utf8Decode } from '../codec/utf8.js';
import { validateBodySize } from '../codec/validate.js';
import { HemError, type HemErrorOptions, HemProtocolError, HemTlsRequiredError, HemUnsupportedError } from '../errors.js';
import type { CallOptions, Transport, TransportResponse } from '../transport/transport.js';

/** API group of an operation, as in the reference. */
export type ApiGroup = 'auth' | 'system' | 'keymgmt' | 'crypto' | 'logger' | 'storage';

/**
 * Description of one device operation. The public method that runs it
 * states, in its TSDoc, the token scope (`Token scope: …`, "none" when
 * `scope` is `null`) and the milestone that introduced it (`Introduced in
 * M<n>.`); a test checks this against the emitted declarations.
 */
// implements: REQ-API-007
export interface OperationSpec {
  /** Public name, `<namespace>.<method>`, used in errors. */
  readonly name: string;
  readonly group: ApiGroup;
  readonly method: 'GET' | 'POST' | 'DELETE';
  /** Path template; `{param}` is replaced by the URL-encoded parameter. */
  readonly path: string;
  /** Token scope template, or `null` for an operation that takes no token. */
  readonly scope: string | null;
  /** Refused before sending unless the device URL is `https:`. */
  readonly tlsOnly: boolean;
  /** Response fields the reference marks as required. */
  readonly required: readonly string[];
  /** The success response is documented as empty. */
  readonly emptyResponse?: boolean;
  /**
   * The request or response carries secrets (login proof, token): errors of
   * this operation never carry the response body or an underlying cause.
   */
  readonly sensitive?: boolean;
  /**
   * Exists only on hardware with mass storage ("MSC build" in the
   * reference); other builds answer 404, which becomes `HemUnsupportedError`.
   * The public method's TSDoc says so.
   */
  readonly mscOnly?: boolean;
}

/** Runs a request with a bearer token for a scope (supplied by the session engine). */
export interface TokenProvider {
  withToken<T>(scope: string, options: CallOptions, send: (bearer: string) => Promise<T>): Promise<T>;
  /** Drop the cached token for `scope`, if any; the next call for it obtains a new one. */
  forget(scope: string): void;
}

/** What a binding needs from its client. */
export interface BindingContext {
  readonly transport: Transport;
  readonly tokens: TokenProvider;
}

/** A parsed JSON object from a success response. */
export type ResponseObject = Readonly<Record<string, unknown>>;

/** Replace `{name}` placeholders with values from `params`. */
export function fillTemplate(template: string, params: Readonly<Record<string, string>>, encode: boolean): string {
  return template.replace(/\{(\w+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined) throw new TypeError(`Missing template parameter ${name}`);
    return encode ? encodeURIComponent(value) : value;
  });
}

/** Tokens are refused when no session engine is configured. */
export const noTokens: TokenProvider = {
  withToken() {
    return Promise.reject(new HemUnsupportedError('This client has no credentials for authenticated operations'));
  },
  forget() {
    // Nothing is cached without a session.
  },
};

/**
 * Parse a success response: JSON object with every required field. Unknown
 * fields are kept and ignored by the caller.
 */
// implements: REQ-API-006
export function parseResponse(spec: OperationSpec, response: TransportResponse): ResponseObject {
  let text: string;
  try {
    text = utf8Decode(response.body);
  } catch (error) {
    throw new HemProtocolError(`${spec.name}: response body is not UTF-8`, { operation: spec.name, status: response.status, cause: error });
  }
  if (text.trim() === '') {
    if (spec.emptyResponse) return {};
    throw new HemProtocolError(`${spec.name}: response body is empty`, { operation: spec.name, status: response.status });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new HemProtocolError(`${spec.name}: response body is not valid JSON`, {
      operation: spec.name,
      status: response.status,
      bodyText: text,
      cause: error,
    });
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new HemProtocolError(`${spec.name}: response body is not a JSON object`, { operation: spec.name, status: response.status, bodyText: text });
  }
  const object = parsed as Record<string, unknown>;
  for (const field of spec.required) {
    if (object[field] === undefined || object[field] === null) {
      throw new HemProtocolError(`${spec.name}: response field "${field}" is missing`, { operation: spec.name, status: response.status, body: object });
    }
  }
  return object;
}

/** Parameters of one invocation. */
export interface Invocation {
  /** Values for the `{…}` placeholders of the path and scope templates. */
  readonly params?: Readonly<Record<string, string>>;
  /** JSON request body. */
  readonly body?: Readonly<Record<string, unknown>>;
}

/**
 * Run one operation and parse its JSON response: see {@link invokeRaw}.
 */
export async function invoke(context: BindingContext, spec: OperationSpec, invocation: Invocation, options: CallOptions = {}): Promise<ResponseObject> {
  const response = await invokeRaw(context, spec, invocation, options);
  try {
    return parseResponse(spec, response);
  } catch (error) {
    throw spec.sensitive ? redact(error) : error;
  }
}

/**
 * A 404 from an operation that exists only on mass-storage hardware means
 * the device does not provide it (REQ-API-011); `alsoMeans` names any other
 * reading of the 404 for this operation.
 */
// implements: REQ-API-011
export function unsupportedOn404(spec: OperationSpec, error: unknown, alsoMeans?: string): unknown {
  if (!spec.mscOnly || !(error instanceof HemError) || error.status !== 404) return error;
  const reason = alsoMeans === undefined ? 'this operation needs mass-storage hardware' : `either this operation needs mass-storage hardware, or ${alsoMeans}`;
  return new HemUnsupportedError(`${spec.name}: the device answered 404 — ${reason}`, { status: 404, operation: spec.name, cause: error });
}

/**
 * Run one operation: serialise and size-check the body, obtain a token when
 * the operation has a scope, send, and return the raw success response
 * (body bytes unparsed). Bindings whose response is not JSON use this
 * directly; the others go through {@link invoke}.
 */
// implements: REQ-API-005
export async function invokeRaw(context: BindingContext, spec: OperationSpec, invocation: Invocation, options: CallOptions = {}): Promise<TransportResponse> {
  // implements: REQ-NET-003 — refused before any request, including the login a token would need.
  if (spec.tlsOnly && !context.transport.secure) {
    throw new HemTlsRequiredError(`${spec.name}: refused to send over plain HTTP; the device URL must use https:`, { operation: spec.name });
  }
  const params = invocation.params ?? {};
  const path = fillTemplate(spec.path, params, true);
  const body = invocation.body === undefined ? undefined : validateBodySize(JSON.stringify(invocation.body));
  const send = (bearer: string | undefined): Promise<TransportResponse> =>
    context.transport.send({
      operation: spec.name,
      method: spec.method,
      path,
      body,
      bearer,
      tlsOnly: spec.tlsOnly,
      signal: options.signal,
      timeoutMs: options.timeoutMs,
    });

  try {
    // implements: REQ-AUTH-012 — an operation without a scope never gets a token, even when tokens are cached.
    return spec.scope === null
      ? await send(undefined)
      : await context.tokens.withToken(fillTemplate(spec.scope, params, false), options, (bearer) => send(bearer));
  } catch (error) {
    throw spec.sensitive ? redact(unsupportedOn404(spec, error)) : unsupportedOn404(spec, error);
  }
}

/**
 * The same error without the response body and without its cause (a JSON
 * parse error quotes the text it failed on), for operations whose responses
 * carry secrets.
 */
// implements: REQ-API-009
export function redact(error: unknown): unknown {
  if (!(error instanceof HemError) || (error.body === undefined && error.bodyText === undefined && error.cause === undefined)) return error;
  const options: HemErrorOptions = {};
  if (error.status !== undefined) options.status = error.status;
  if (error.operation !== undefined) options.operation = error.operation;
  const ErrorClass = error.constructor as new (message: string, options?: HemErrorOptions) => HemError;
  return new ErrorClass(error.message, options);
}

// ----- typed field readers: a field of the wrong type is a protocol error naming it -----

function wrongType(spec: OperationSpec, field: string, expected: string): HemProtocolError {
  return new HemProtocolError(`${spec.name}: response field "${field}" is not ${expected}`, { operation: spec.name });
}

export function readString(spec: OperationSpec, object: ResponseObject, field: string): string {
  const value = object[field];
  if (typeof value !== 'string') throw wrongType(spec, field, 'a string');
  return value;
}

export function readNumber(spec: OperationSpec, object: ResponseObject, field: string): number {
  const value = object[field];
  if (typeof value !== 'number' || !Number.isFinite(value)) throw wrongType(spec, field, 'a number');
  return value;
}

export function readInteger(spec: OperationSpec, object: ResponseObject, field: string): number {
  const value = readNumber(spec, object, field);
  if (!Number.isInteger(value)) throw wrongType(spec, field, 'an integer');
  return value;
}

export function readBoolean(spec: OperationSpec, object: ResponseObject, field: string): boolean {
  const value = object[field];
  if (typeof value !== 'boolean') throw wrongType(spec, field, 'a boolean');
  return value;
}

/** A base64 field (either alphabet, padding optional) as bytes. */
export function readBase64(spec: OperationSpec, object: ResponseObject, field: string): Uint8Array {
  try {
    return base64ToBytes(readString(spec, object, field), `field "${field}"`);
  } catch (error) {
    if (error instanceof HemProtocolError && error.operation === spec.name) throw error;
    throw new HemProtocolError(`${spec.name}: response field "${field}" is not valid base64`, { operation: spec.name, cause: error });
  }
}

/** A hexadecimal field as bytes. */
export function readHex(spec: OperationSpec, object: ResponseObject, field: string): Uint8Array {
  try {
    return hexToBytes(readString(spec, object, field), `field "${field}"`);
  } catch (error) {
    if (error instanceof HemProtocolError && error.operation === spec.name) throw error;
    throw new HemProtocolError(`${spec.name}: response field "${field}" is not valid hexadecimal`, { operation: spec.name, cause: error });
  }
}

export function readStringArray(spec: OperationSpec, object: ResponseObject, field: string): string[] {
  const value = object[field];
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw wrongType(spec, field, 'an array of strings');
  return [...value] as string[];
}

/** Read an optional field with `reader`; `undefined` when absent. */
export function optional<T>(
  reader: (spec: OperationSpec, object: ResponseObject, field: string) => T,
  spec: OperationSpec,
  object: ResponseObject,
  field: string,
): T | undefined {
  return object[field] === undefined || object[field] === null ? undefined : reader(spec, object, field);
}
