// Bindings of the keymgmt group.
// implements: REQ-KEY-001, REQ-KEY-002, REQ-KEY-003, REQ-KEY-004, REQ-API-005, REQ-NET-003, REQ-AUTH-005

import { encodeBase64 } from "../codec/base64.js";
import { bytesEqual } from "../codec/utf8.js";
import {
  MAX_PAGE_SIZE,
  validateBytes,
  validateDescription,
  validateInteger,
  validateKid,
  validateLabel,
  validateOneOf,
} from "../codec/validate.js";
import { HemProtocolError, HemValidationError } from "../errors.js";
import { callOptions, type ClientContext } from "../internal/context.js";
import { optBytes, optNumber, parseObject, reqNumber, reqString, type JsonObject } from "../internal/parse.js";
import type { CallOptions, DeviceRequest } from "../transport/transport.js";
import { parseKeyType, type KeyType } from "./keytype.js";

/** Key types that can be generated [YAML]. `SHA*` types are HMAC keys. */
export const CREATABLE_KEY_TYPES = [
  "SECP256R1", "SECP384R1", "SECP521R1", "SECP256K1",
  "CURVE25519", "CURVE448", "ED25519", "ED448",
  "SHA2-256", "SHA2-384", "SHA2-512", "SHA3-256", "SHA3-384", "SHA3-512",
  "AES128", "AES192", "AES256",
  "MLKEM512", "MLKEM768", "MLKEM1024", "MLDSA44", "MLDSA65", "MLDSA87",
] as const;
export type CreatableKeyType = (typeof CREATABLE_KEY_TYPES)[number];

/** Key-usage modes of `SECP*` keys; the literals are exact (`ExDSA,ECDH` is refused by the device). */
export const KEY_MODES = ["ECDH", "ExDSA", "ECDH,ExDSA"] as const;
export type KeyMode = (typeof KEY_MODES)[number];

export interface CreateKeyParams {
  /** 1 to 32 printable ASCII characters. */
  label: string;
  type: CreatableKeyType;
  /** `SECP*` types only: `ECDH` (the device's default), `ExDSA` or `ECDH,ExDSA`. */
  mode?: KeyMode | undefined;
  /** Binary description, at most 64 bytes; searchable with `search`. */
  description?: Uint8Array | undefined;
}

/** A key as returned by key get. */
export interface KeyDetails {
  readonly kid: string;
  /** Last attribute update, Unix seconds. */
  readonly updated: number;
  /** The key type (for asymmetric keys a bare algorithm name). */
  readonly type: KeyType | undefined;
  /** Public key: compressed X9.63 for `SECP*`, raw for the other asymmetric types. */
  readonly pubkey: Uint8Array | undefined;
  /** Stored DER blob of generic-DER records. */
  readonly der: Uint8Array | undefined;
  /** Description, when the device returns it (firmware 1.2.2 does not). */
  readonly description: Uint8Array | undefined;
}

/** A key as listed by list and search. */
export interface KeyInfo {
  readonly kid: string;
  readonly type: KeyType;
  readonly label: string;
  /** Creation time, Unix seconds. */
  readonly created: number;
  /** Last attribute update, Unix seconds. */
  readonly updated: number;
  /** Binary description, when not empty. */
  readonly description: Uint8Array | undefined;
}

/** One page of a listing or a search. */
export interface KeyPage {
  /** Offset of this page. */
  readonly offset: number;
  /** Valid records in the repository (list), or matching records (search). */
  readonly total: number;
  /** Number of keys on this page. */
  readonly listed: number;
  /** Deleted or invalid records the device skipped, when reported. */
  readonly deleted: number | undefined;
  readonly keys: readonly KeyInfo[];
}

export interface ListKeysParams {
  /** Records to skip (non-negative integer). */
  offset?: number | undefined;
  /** Page size, 1 to 15. */
  count?: number | undefined;
}

export interface SearchKeysParams {
  /** The bytes to look for in key descriptions, 1 to 64 bytes. */
  description: Uint8Array;
  /** Where the bytes must appear (default `prefix`). */
  match?: "prefix" | "suffix" | "contains" | undefined;
  /** Matches to skip (non-negative integer). */
  offset?: number | undefined;
  /** Page size, 1 to 15. */
  limit?: number | undefined;
}

/** `client.keys`: key management. Every operation requires an `https:` device URL. */
export interface KeysApi {
  /**
   * Generates a key on the device (`POST /api/keymgmt/create`) and returns
   * its key id. A `SECP*` key is created for ECDH only unless `mode`
   * includes `ExDSA`; without it the key cannot sign (the device answers 406).
   * `mode` is ignored by the device for other types.
   *
   * @scope keymgmt:gen
   * @milestone M1
   */
  create(params: CreateKeyParams, options?: CallOptions): Promise<string>;

  /**
   * Reads one key (`GET /api/keymgmt/get/{kid}`): type, public key and update
   * time. Public keys are compressed X9.63 for `SECP*` types and raw for
   * X25519, X448, Ed25519, Ed448, ML-KEM and ML-DSA. The device does not
   * return the label, and on firmware 1.2.2 not the description either: read
   * those through `list` or `search`. A missing key raises
   * `HemOperationFailedError` (406).
   *
   * @scope keymgmt:use:<kid> (the same token serves crypto operations on that key)
   * @milestone M1
   */
  get(kid: string, options?: CallOptions): Promise<KeyDetails>;

  /**
   * Finds keys whose description starts with, ends with or contains the given
   * bytes (`POST /api/keymgmt/search`). The device matches the base64 text of
   * the stored description. No match is an empty page.
   *
   * @scope keymgmt:search
   * @milestone M1
   */
  search(params: SearchKeysParams, options?: CallOptions): Promise<KeyPage>;

  /**
   * Returns every key whose description equals `description` exactly, by
   * prefix search over all result pages and comparison.
   *
   * @scope keymgmt:search
   * @milestone M1
   */
  findByDescription(description: Uint8Array, options?: CallOptions): Promise<KeyInfo[]>;

  /**
   * Lists one page of keys (`GET /api/keymgmt/list[/{offset}[/{count}]]`).
   * The device returns at most 15 keys per page.
   *
   * @scope keymgmt:list
   * @milestone M1
   */
  list(params?: ListKeysParams, options?: CallOptions): Promise<KeyPage>;

  /**
   * Iterates over all keys, page by page, until the offset reaches `total`
   * or a page comes back empty (never merely because a page is short).
   *
   * @scope keymgmt:list
   * @milestone M1
   */
  iterate(params?: { pageSize?: number | undefined }, options?: CallOptions): AsyncIterable<KeyInfo>;
}

const SEARCH_PATH = "/api/keymgmt/search";

export function parseKeyInfo(o: unknown, operation: string): KeyInfo {
  const k = (o !== null && typeof o === "object" ? o : {}) as JsonObject;
  return {
    kid: reqString(k, "kid", operation).toLowerCase(),
    type: parseKeyType(reqString(k, "type", operation)),
    label: reqString(k, "label", operation),
    created: reqNumber(k, "created", operation),
    updated: reqNumber(k, "updated", operation),
    description: optBytes(k, "descr", operation),
  };
}

export function parseKeyPage(o: JsonObject, operation: string): KeyPage {
  const list = o["list"];
  if (!Array.isArray(list)) {
    throw new HemProtocolError(`${operation}: response field "list" is missing or not an array`, { operation });
  }
  const keys = list.map((k) => parseKeyInfo(k, operation));
  return {
    offset: reqNumber(o, "offset", operation),
    total: reqNumber(o, "total", operation),
    listed: optNumber(o, "listed", operation) ?? keys.length,
    deleted: optNumber(o, "deleted", operation),
    keys,
  };
}

export class KeysApiImpl implements KeysApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }

  #call(req: Omit<DeviceRequest, "signal" | "timeoutMs">, scope: string, options: CallOptions | undefined) {
    return this.#ctx.session.authorized({ ...req, requiresTls: true, ...callOptions(options) }, scope);
  }

  async create(params: CreateKeyParams, options?: CallOptions): Promise<string> {
    const operation = "keys.create";
    const p = params ?? ({} as CreateKeyParams);
    const body: Record<string, string> = {
      label: validateLabel(p.label),
      type: validateOneOf(p.type, "type", CREATABLE_KEY_TYPES),
    };
    if (p.mode !== undefined) body["mode"] = validateOneOf(p.mode, "mode", KEY_MODES);
    if (p.description !== undefined) body["descr"] = encodeBase64(validateDescription(p.description));
    const res = await this.#call({ operation, method: "POST", path: "/api/keymgmt/create", body }, "keymgmt:gen", options);
    return reqString(parseObject(res, operation), "kid", operation).toLowerCase();
  }

  async get(kid: string, options?: CallOptions): Promise<KeyDetails> {
    const operation = "keys.get";
    const k = validateKid(kid);
    const res = await this.#call({ operation, method: "GET", path: `/api/keymgmt/get/${k}` }, `keymgmt:use:${k}`, options);
    const o = parseObject(res, operation);
    const type = o["type"];
    return {
      kid: k,
      updated: reqNumber(o, "updated", operation),
      type: typeof type === "string" ? parseKeyType(type) : undefined,
      pubkey: optBytes(o, "pubkey", operation),
      der: optBytes(o, "der", operation),
      description: optBytes(o, "descr", operation),
    };
  }

  async search(params: SearchKeysParams, options?: CallOptions): Promise<KeyPage> {
    const operation = "keys.search";
    const p = params ?? ({} as SearchKeysParams);
    const needle = validateDescription(p.description);
    if (needle.length === 0) throw new HemValidationError("description", "must not be empty");
    const match = p.match === undefined ? "prefix" : validateOneOf(p.match, "match", ["prefix", "suffix", "contains"] as const);
    const b64 = encodeBase64(needle);
    const body: Record<string, string | number> = {
      descr: match === "prefix" ? `^${b64}` : match === "suffix" ? `${b64}$` : b64,
    };
    if (p.offset !== undefined) body["offset"] = validateInteger(p.offset, "offset", 0);
    if (p.limit !== undefined) body["limit"] = validateInteger(p.limit, "limit", 1, MAX_PAGE_SIZE);
    const req = { operation, method: "POST" as const, path: SEARCH_PATH, body };
    let res;
    try {
      res = await this.#call(req, "keymgmt:search", options);
    } catch (e) {
      // older firmware answers "no match" with 404 [C-SDK]
      if ((e as { status?: number }).status === 404) {
        return { offset: p.offset ?? 0, total: 0, listed: 0, deleted: undefined, keys: [] };
      }
      throw e;
    }
    return parseKeyPage(parseObject(res, operation), operation);
  }

  async findByDescription(description: Uint8Array, options?: CallOptions): Promise<KeyInfo[]> {
    const needle = validateBytes(description, "description");
    const found: KeyInfo[] = [];
    for (let offset = 0; ; ) {
      const page = await this.search({ description: needle, match: "prefix", offset, limit: MAX_PAGE_SIZE }, options);
      for (const k of page.keys) if (k.description && bytesEqual(k.description, needle)) found.push(k);
      offset += page.keys.length;
      if (page.keys.length === 0 || offset >= page.total) return found;
    }
  }

  async list(params: ListKeysParams = {}, options?: CallOptions): Promise<KeyPage> {
    const operation = "keys.list";
    const p = params ?? {};
    const offset = p.offset === undefined ? undefined : validateInteger(p.offset, "offset", 0);
    const count = p.count === undefined ? undefined : validateInteger(p.count, "count", 1, MAX_PAGE_SIZE);
    const path =
      count !== undefined
        ? `/api/keymgmt/list/${offset ?? 0}/${count}`
        : offset !== undefined
          ? `/api/keymgmt/list/${offset}`
          : "/api/keymgmt/list";
    const res = await this.#call({ operation, method: "GET", path }, "keymgmt:list", options);
    return parseKeyPage(parseObject(res, operation), operation);
  }

  async *iterate(params: { pageSize?: number | undefined } = {}, options?: CallOptions): AsyncIterable<KeyInfo> {
    const count = params?.pageSize === undefined ? MAX_PAGE_SIZE : validateInteger(params.pageSize, "pageSize", 1, MAX_PAGE_SIZE);
    for (let offset = 0; ; ) {
      const page = await this.list({ offset, count }, options);
      yield* page.keys;
      offset += page.keys.length;
      if (page.keys.length === 0 || offset >= page.total) return;
    }
  }
}
