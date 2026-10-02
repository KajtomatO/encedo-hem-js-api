// Input validation against the hard limits of the API reference.
// implements: REQ-API-005

import { HemValidationError } from "../errors.js";
import { utf8Encode } from "./utf8.js";

/** Largest JSON request body the device accepts, in bytes. */
export const MAX_JSON_BODY_BYTES = 7300;
/** Largest label, in printable ASCII characters. */
export const MAX_LABEL_LENGTH = 32;
/** Largest key description, in bytes. */
export const MAX_DESCRIPTION_BYTES = 64;
/** Largest message for HMAC and wrap, in bytes. */
export const MAX_MESSAGE_BYTES = 2048;
/** Largest page of keys the device returns. */
export const MAX_PAGE_SIZE = 15;

const KID = /^[0-9a-fA-F]{32}$/;
const PRINTABLE_ASCII = /^[\x20-\x7e]+$/;

/** Checks a key id (32 hex characters) and returns it in lower case. */
export function validateKid(kid: unknown, parameter = "kid"): string {
  if (typeof kid !== "string" || !KID.test(kid)) {
    throw new HemValidationError(parameter, "must be exactly 32 hexadecimal characters");
  }
  return kid.toLowerCase();
}

/** Checks a label: 1 to 32 printable ASCII characters. */
export function validateLabel(label: unknown, parameter = "label"): string {
  if (typeof label !== "string" || label.length < 1 || label.length > MAX_LABEL_LENGTH || !PRINTABLE_ASCII.test(label)) {
    throw new HemValidationError(parameter, `must be 1 to ${MAX_LABEL_LENGTH} printable ASCII characters`);
  }
  return label;
}

/** Checks a byte array parameter. */
export function validateBytes(value: unknown, parameter: string): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new HemValidationError(parameter, "must be a Uint8Array");
  return value;
}

/** Checks a key description: at most 64 bytes. */
export function validateDescription(descr: unknown, parameter = "description"): Uint8Array {
  const bytes = validateBytes(descr, parameter);
  if (bytes.length > MAX_DESCRIPTION_BYTES) {
    throw new HemValidationError(parameter, `must be at most ${MAX_DESCRIPTION_BYTES} bytes`);
  }
  return bytes;
}

/** Checks a message: 1 to 2048 bytes (empty allowed only when `allowEmpty`). */
export function validateMessage(msg: unknown, parameter = "message", allowEmpty = false): Uint8Array {
  const bytes = validateBytes(msg, parameter);
  if (!allowEmpty && bytes.length === 0) throw new HemValidationError(parameter, "must not be empty");
  if (bytes.length > MAX_MESSAGE_BYTES) {
    throw new HemValidationError(parameter, `must be at most ${MAX_MESSAGE_BYTES} bytes`);
  }
  return bytes;
}

/** Checks the serialised JSON body against the device's 7300-byte limit. */
export function validateBodySize(serialised: string, parameter = "body"): void {
  const size = utf8Encode(serialised).length;
  if (size > MAX_JSON_BODY_BYTES) {
    throw new HemValidationError(parameter, `serialised request is ${size} bytes; the device accepts at most ${MAX_JSON_BODY_BYTES}`);
  }
}

/** Checks an integer within an inclusive range. */
export function validateInteger(value: unknown, parameter: string, min: number, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    const range = max === Number.MAX_SAFE_INTEGER ? `an integer >= ${min}` : `an integer from ${min} to ${max}`;
    throw new HemValidationError(parameter, `must be ${range}`);
  }
  return value;
}

/** Checks that a value is one of a fixed set of string literals. */
export function validateOneOf<T extends string>(value: unknown, parameter: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new HemValidationError(parameter, `must be one of ${allowed.join(", ")}`);
  }
  return value as T;
}

/** Checks a string length in characters (UTF-16 code units are not used: code points are counted). */
export function validateStringLength(value: unknown, parameter: string, min: number, max: number): string {
  if (typeof value !== "string") throw new HemValidationError(parameter, "must be a string");
  const length = [...value].length;
  if (length < min || length > max) throw new HemValidationError(parameter, `must be ${min} to ${max} characters`);
  return value;
}
