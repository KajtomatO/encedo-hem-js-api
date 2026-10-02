// Tolerant parsing of success responses: unknown fields are ignored, a
// missing or mistyped required field is a HemProtocolError naming it.
// implements: REQ-API-006

import { decodeBase64 } from "../codec/base64.js";
import { HemProtocolError } from "../errors.js";
import type { DeviceResponse } from "../transport/transport.js";

export type JsonObject = Record<string, unknown>;

/** Parses a 2xx body that must be a JSON object. */
export function parseObject(res: DeviceResponse, operation: string): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(res.text);
  } catch {
    throw new HemProtocolError(`${operation}: the response is not valid JSON`, { operation, status: res.status });
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HemProtocolError(`${operation}: the response is not a JSON object`, { operation, status: res.status });
  }
  return value as JsonObject;
}

/** Accepts a 2xx body that is documented as empty (anything that is sent is ignored). */
export function expectEmpty(_res: DeviceResponse): void {}

function missing(operation: string, field: string, what: string): HemProtocolError {
  return new HemProtocolError(`${operation}: response field "${field}" is missing or not ${what}`, { operation });
}

export function reqString(obj: JsonObject, field: string, operation: string): string {
  const v = obj[field];
  if (typeof v !== "string") throw missing(operation, field, "a string");
  return v;
}

export function optString(obj: JsonObject, field: string, operation: string): string | undefined {
  const v = obj[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw missing(operation, field, "a string");
  return v;
}

export function reqNumber(obj: JsonObject, field: string, operation: string): number {
  const v = obj[field];
  if (typeof v !== "number" || !Number.isFinite(v)) throw missing(operation, field, "a number");
  return v;
}

export function optNumber(obj: JsonObject, field: string, operation: string): number | undefined {
  const v = obj[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "number" || !Number.isFinite(v)) throw missing(operation, field, "a number");
  return v;
}

export function optBoolean(obj: JsonObject, field: string, operation: string): boolean | undefined {
  const v = obj[field];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "boolean") throw missing(operation, field, "a boolean");
  return v;
}

export function reqBytes(obj: JsonObject, field: string, operation: string): Uint8Array {
  return toBytes(reqString(obj, field, operation), field, operation);
}

export function optBytes(obj: JsonObject, field: string, operation: string): Uint8Array | undefined {
  const s = optString(obj, field, operation);
  return s === undefined ? undefined : toBytes(s, field, operation);
}

function toBytes(text: string, field: string, operation: string): Uint8Array {
  try {
    return decodeBase64(text);
  } catch {
    throw missing(operation, field, "valid base64");
  }
}
