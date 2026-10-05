/**
 * Validators for the hard input limits of the HEM API reference
 * (ref/api/hem-api-1.2.2.yaml). Each one raises {@link HemValidationError}
 * naming the parameter, before anything is sent. Validators never alter
 * caller data, except that a key id is normalised to lower case.
 *
 * @packageDocumentation
 */
import { HemValidationError } from '../errors.js';
import { utf8Length } from './utf8.js';

/** Largest serialised JSON request body the device accepts, in bytes. */
export const MAX_JSON_BODY_BYTES = 7300;
/** Largest key label, in characters. */
export const MAX_LABEL_LENGTH = 32;
/** Largest key description, in bytes. */
export const MAX_DESCRIPTION_BYTES = 64;
/** Largest message for a crypto operation, in bytes. */
export const MAX_MESSAGE_BYTES = 2048;

const KID = /^[0-9a-fA-F]{32}$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]*$/;

function fail(parameter: string, problem: string): never {
  throw new HemValidationError(`Invalid ${parameter}: ${problem}`, { parameter });
}

function requireBytes(value: unknown, parameter: string): asserts value is Uint8Array {
  if (!(value instanceof Uint8Array)) fail(parameter, 'must be a Uint8Array');
}

/** A key id: exactly 32 hexadecimal characters. Returns it in lower case. */
// implements: REQ-API-005
export function validateKid(kid: unknown, parameter = 'kid'): string {
  if (typeof kid !== 'string' || !KID.test(kid)) fail(parameter, 'must be exactly 32 hexadecimal characters');
  return kid.toLowerCase();
}

/** A key label: 1 to 32 printable ASCII characters. */
// implements: REQ-API-005
export function validateLabel(label: unknown, parameter = 'label'): string {
  if (typeof label !== 'string') fail(parameter, 'must be a string');
  if (label.length < 1 || label.length > MAX_LABEL_LENGTH) fail(parameter, `must be 1 to ${MAX_LABEL_LENGTH} characters long`);
  if (!PRINTABLE_ASCII.test(label)) fail(parameter, 'must contain only printable ASCII characters');
  return label;
}

/** A key description: at most 64 bytes. */
// implements: REQ-API-005
export function validateDescription(description: unknown, parameter = 'descr'): Uint8Array {
  requireBytes(description, parameter);
  if (description.length > MAX_DESCRIPTION_BYTES) fail(parameter, `must be at most ${MAX_DESCRIPTION_BYTES} bytes`);
  return description;
}

/** A message for a crypto operation: at most 2048 bytes, and not empty unless `allowEmpty`. */
// implements: REQ-API-005
export function validateMessage(message: unknown, parameter = 'msg', { allowEmpty = false }: { allowEmpty?: boolean } = {}): Uint8Array {
  requireBytes(message, parameter);
  if (message.length === 0 && !allowEmpty) fail(parameter, 'must not be empty');
  if (message.length > MAX_MESSAGE_BYTES) fail(parameter, `must be at most ${MAX_MESSAGE_BYTES} bytes`);
  return message;
}

/** A serialised JSON request body: at most 7300 bytes as UTF-8. */
// implements: REQ-API-005
export function validateBodySize(json: string, parameter = 'body'): string {
  const size = utf8Length(json);
  if (size > MAX_JSON_BODY_BYTES) fail(parameter, `request body is ${size} bytes; the device accepts at most ${MAX_JSON_BODY_BYTES}`);
  return json;
}
