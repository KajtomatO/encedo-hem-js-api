/**
 * Key-management bindings (M1): create and get; list and search.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateDescription, validateKid, validateLabel } from '../codec/validate.js';
import { HemDeviceError, HemProtocolError, HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import {
  type BindingContext,
  type OperationSpec,
  type ResponseObject,
  invoke,
  optional,
  readBase64,
  readInteger,
  readString,
} from './core.js';
import { KEY_MODES, KEY_TYPES, type KeyMode, type KeyType, type KeyTypeInfo, parseKeyType } from './key-type.js';

export const KEY_CREATE: OperationSpec = {
  name: 'keys.create',
  group: 'keymgmt',
  method: 'POST',
  path: '/api/keymgmt/create',
  scope: 'keymgmt:gen',
  tlsOnly: true,
  required: ['kid'],
};

export const KEY_GET: OperationSpec = {
  name: 'keys.get',
  group: 'keymgmt',
  method: 'GET',
  path: '/api/keymgmt/get/{kid}',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['updated'],
};

export const KEY_LIST: OperationSpec = {
  name: 'keys.list',
  group: 'keymgmt',
  method: 'GET',
  path: '/api/keymgmt/list',
  scope: 'keymgmt:list',
  tlsOnly: true,
  required: ['offset', 'total', 'listed', 'list'],
};

export const KEY_LIST_OFFSET: OperationSpec = { ...KEY_LIST, path: '/api/keymgmt/list/{offset}' };

export const KEY_LIST_PAGE: OperationSpec = { ...KEY_LIST, path: '/api/keymgmt/list/{offset}/{count}' };

export const KEY_SEARCH: OperationSpec = {
  name: 'keys.search',
  group: 'keymgmt',
  method: 'POST',
  path: '/api/keymgmt/search',
  scope: 'keymgmt:search',
  tlsOnly: true,
  required: ['offset', 'total', 'listed', 'list'],
};

/** Largest page the device returns. */
export const MAX_PAGE_SIZE = 15;

/** One record of the key repository, as listed or found. */
export interface KeyEntry {
  /** Key id, 32 lower-case hex characters. */
  readonly kid: string;
  /** Key type: attribute flags and algorithm. */
  readonly type: KeyTypeInfo;
  /** Label. */
  readonly label: string;
  /** Creation time, Unix seconds. */
  readonly created: number;
  /** Last attribute update, Unix seconds. */
  readonly updated: number;
  /** Description, when the key has one. */
  readonly descr?: Uint8Array;
}

/** One page of keys. */
export interface KeyPage {
  /** Offset of the first key of this page. */
  readonly offset: number;
  /** Valid records in the repository (list) or matching keys (search). */
  readonly total: number;
  /** Number of keys on this page. */
  readonly listed: number;
  /** Deleted or invalid records the device skipped. */
  readonly deleted: number;
  readonly keys: readonly KeyEntry[];
}

/** Paging of {@link KeysApi.list}. */
export interface ListKeysParams {
  /** Number of keys to skip; default 0. */
  offset?: number | undefined;
  /** Page size from 1 to 15; default 15. */
  count?: number | undefined;
}

/** How a search needle is matched against key descriptions. */
export type DescriptionMatch = 'prefix' | 'suffix' | 'contains';

/** Parameters of {@link KeysApi.search}. */
export interface SearchKeysParams {
  /** Bytes to look for, 1 to 64. */
  descr: Uint8Array;
  /** Where the bytes must appear in the description; default `contains`. */
  match?: DescriptionMatch | undefined;
  /** Matching keys to skip; default 0. */
  offset?: number | undefined;
  /** Page size from 1 to 15; default 15. */
  limit?: number | undefined;
}

function validateOffset(value: unknown, parameter = 'offset'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new HemValidationError(`Invalid ${parameter}: must be a whole number of 0 or more`, { parameter });
  }
  return value;
}

function validatePageSize(value: unknown, parameter: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > MAX_PAGE_SIZE) {
    throw new HemValidationError(`Invalid ${parameter}: must be a whole number from 1 to ${MAX_PAGE_SIZE}`, { parameter });
  }
  return value;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

/** Map a list or search envelope. */
function readPage(spec: OperationSpec, r: ResponseObject): KeyPage {
  const list = r['list'];
  if (!Array.isArray(list)) throw new HemProtocolError(`${spec.name}: response field "list" is not an array`, { operation: spec.name });
  const keys = list.map((item: unknown, index): KeyEntry => {
    if (typeof item !== 'object' || item === null) {
      throw new HemProtocolError(`${spec.name}: list entry ${index} is not an object`, { operation: spec.name });
    }
    const entry = item as ResponseObject;
    for (const field of ['kid', 'created', 'type', 'label', 'updated']) {
      if (entry[field] === undefined || entry[field] === null) {
        throw new HemProtocolError(`${spec.name}: response field "list[${index}].${field}" is missing`, { operation: spec.name });
      }
    }
    const descr = optional(readBase64, spec, entry, 'descr');
    return {
      kid: readKid(spec, entry),
      type: parseKeyType(readString(spec, entry, 'type')),
      label: readString(spec, entry, 'label'),
      created: readInteger(spec, entry, 'created'),
      updated: readInteger(spec, entry, 'updated'),
      ...(descr === undefined ? {} : { descr }),
    };
  });
  return {
    offset: readInteger(spec, r, 'offset'),
    total: readInteger(spec, r, 'total'),
    listed: readInteger(spec, r, 'listed'),
    deleted: optional(readInteger, spec, r, 'deleted') ?? 0,
    keys,
  };
}

/** Parameters of {@link KeysApi.create}. */
export interface CreateKeyParams {
  /** 1 to 32 printable ASCII characters. */
  label: string;
  /** Key type; `SHA*` types are HMAC keys. */
  type: KeyType;
  /** Usage of a `SECP*` key: `ECDH` (the device default), `ExDSA`, or `ECDH,ExDSA`. Ignored by the device for other types. */
  mode?: KeyMode | undefined;
  /** Binary description, at most 64 bytes; searchable with `keys.search`. */
  descr?: Uint8Array | undefined;
}

/** A key as returned by {@link KeysApi.get}. */
export interface KeyDetails {
  /** Last attribute update, Unix seconds. */
  readonly updated: number;
  /** Key type, when the device reports it. */
  readonly type?: KeyTypeInfo;
  /** Public key of an asymmetric key: compressed X9.63 for `SECP*`, raw for the others. */
  readonly pubkey?: Uint8Array;
  /** Stored DER blob of a generic-DER record. */
  readonly der?: Uint8Array;
  /** Description, when the device returns it (firmware 1.2.2 in practice does not). */
  readonly descr?: Uint8Array;
}

/** Read a key id from a response: 32 hexadecimal characters, returned in lower case. */
export function readKid(spec: OperationSpec, object: ResponseObject, field = 'kid'): string {
  const kid = readString(spec, object, field);
  if (!/^[0-9a-fA-F]{32}$/.test(kid)) throw new HemProtocolError(`${spec.name}: response field "${field}" is not a 32-hex-character key id`, { operation: spec.name });
  return kid.toLowerCase();
}

/** `client.keys`: the device's key repository. Every call needs an `https:` device URL. */
export class KeysApi {
  readonly #context: BindingContext;

  /** @internal */
  constructor(context: BindingContext) {
    this.#context = context;
  }

  /**
   * Generate a key on the device and return its key id (32 lower-case hex
   * characters). The key material never leaves the device.
   *
   * A `SECP*` key is created for ECDH only unless `mode` includes `ExDSA`;
   * such a key cannot sign. The mode literals are exact (`ExDSA,ECDH` is
   * rejected). Generating a post-quantum key (`MLKEM*`, `MLDSA*`) can take
   * longer than the default 30 s limit; pass a larger `timeoutMs` for it.
   *
   * Device call: `POST /api/keymgmt/create`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:gen`. Introduced in M1.
   */
  // implements: REQ-KEY-001
  async create(params: CreateKeyParams, options?: CallOptions): Promise<string> {
    const label = validateLabel(params?.label);
    if (!(KEY_TYPES as readonly string[]).includes(params.type)) {
      throw new HemValidationError(`Invalid type: must be one of ${KEY_TYPES.join(', ')}`, { parameter: 'type' });
    }
    const body: Record<string, unknown> = { label, type: params.type };
    if (params.mode !== undefined) {
      if (!(KEY_MODES as readonly string[]).includes(params.mode)) {
        throw new HemValidationError(`Invalid mode: must be exactly one of ${KEY_MODES.join(', ')}`, { parameter: 'mode' });
      }
      body['mode'] = params.mode;
    }
    if (params.descr !== undefined) body['descr'] = bytesToBase64(validateDescription(params.descr));
    const r = await invoke(this.#context, KEY_CREATE, { body }, options);
    return readKid(KEY_CREATE, r);
  }

  /**
   * Read one key: its type and public material. Private material is never
   * returned. Public keys are compressed X9.63 for the `SECP*` types and raw
   * for the others. Firmware 1.2.2 returns neither the label nor, in
   * practice, the description here; read those through `keys.list` or
   * `keys.search`. An unknown key id raises `HemOperationFailedError` (406).
   *
   * Device call: `GET /api/keymgmt/get/{kid}`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>` (the same token serves crypto
   * operations on that key). Introduced in M1.
   */
  // implements: REQ-KEY-002
  async get(kid: string, options?: CallOptions): Promise<KeyDetails> {
    const spec = KEY_GET;
    const r = await invoke(this.#context, spec, { params: { kid: validateKid(kid) } }, options);
    const type = optional(readString, spec, r, 'type');
    const details: { -readonly [K in keyof KeyDetails]: KeyDetails[K] } = { updated: readInteger(spec, r, 'updated') };
    if (type !== undefined) details.type = parseKeyType(type);
    const pubkey = optional(readBase64, spec, r, 'pubkey');
    if (pubkey !== undefined) details.pubkey = pubkey;
    const der = optional(readBase64, spec, r, 'der');
    if (der !== undefined) details.der = der;
    const descr = optional(readBase64, spec, r, 'descr');
    if (descr !== undefined) details.descr = descr;
    return details;
  }

  /**
   * One page of the key repository, at most 15 keys. Labels and
   * descriptions are available here (key get does not return them).
   *
   * Device calls: `GET /api/keymgmt/list`, `/list/{offset}` or
   * `/list/{offset}/{count}`, chosen from the parameters. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:list`. Introduced in M1.
   */
  // implements: REQ-KEY-004
  async list(params: ListKeysParams = {}, options?: CallOptions): Promise<KeyPage> {
    const offset = params.offset === undefined ? undefined : validateOffset(params.offset);
    const count = params.count === undefined ? undefined : validatePageSize(params.count, 'count');
    let spec = KEY_LIST;
    const values: Record<string, string> = {};
    if (count !== undefined) {
      spec = KEY_LIST_PAGE;
      values['offset'] = String(offset ?? 0);
      values['count'] = String(count);
    } else if (offset !== undefined) {
      spec = KEY_LIST_OFFSET;
      values['offset'] = String(offset);
    }
    return readPage(spec, await invoke(this.#context, spec, { params: values }, options));
  }

  /**
   * Every key in the repository, page by page. Stops when the offset
   * reaches the reported total or a page comes back empty — not when a page
   * is merely short.
   *
   * @remarks Token scope: `keymgmt:list`. Introduced in M1.
   */
  // implements: REQ-KEY-004
  async listAll(options?: CallOptions): Promise<KeyEntry[]> {
    const keys: KeyEntry[] = [];
    let offset = 0;
    for (;;) {
      const page = await this.list({ offset, count: MAX_PAGE_SIZE }, options);
      keys.push(...page.keys);
      offset += page.keys.length;
      if (page.keys.length === 0 || offset >= page.total) return keys;
    }
  }

  /**
   * Find keys by their description. The device matches the base64 text of
   * the needle against the base64 text of each stored description: the
   * needle is sent as base64 with a leading `^` (prefix) or a trailing `$`
   * (suffix). Because the comparison happens on base64 text, a needle whose
   * length is not a multiple of three bytes may not match where the bytes
   * do; this is unverified on the device. For an exact match use
   * {@link KeysApi.findByDescription}. No match gives an empty page (also
   * for the 404 of older firmware).
   *
   * Device call: `POST /api/keymgmt/search`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:search`. Introduced in M1.
   */
  // implements: REQ-KEY-003
  async search(params: SearchKeysParams, options?: CallOptions): Promise<KeyPage> {
    const needle = validateDescription(params?.descr, 'descr');
    if (needle.length === 0) throw new HemValidationError('Invalid descr: must not be empty', { parameter: 'descr' });
    const match = params.match ?? 'contains';
    if (match !== 'prefix' && match !== 'suffix' && match !== 'contains') {
      throw new HemValidationError('Invalid match: must be prefix, suffix or contains', { parameter: 'match' });
    }
    const encoded = bytesToBase64(needle);
    const body: Record<string, unknown> = { descr: match === 'prefix' ? `^${encoded}` : match === 'suffix' ? `${encoded}$` : encoded };
    if (params.offset !== undefined) body['offset'] = validateOffset(params.offset);
    if (params.limit !== undefined) body['limit'] = validatePageSize(params.limit, 'limit');
    try {
      return readPage(KEY_SEARCH, await invoke(this.#context, KEY_SEARCH, { body }, options));
    } catch (error) {
      // Older firmware answers "no match" with 404.
      if (error instanceof HemDeviceError && error.status === 404) {
        return { offset: params.offset ?? 0, total: 0, listed: 0, deleted: 0, keys: [] };
      }
      throw error;
    }
  }

  /**
   * The keys whose description equals `descr` exactly: a prefix search over
   * all result pages, filtered byte for byte.
   *
   * @remarks Token scope: `keymgmt:search`. Introduced in M1.
   */
  // implements: REQ-KEY-003
  async findByDescription(descr: Uint8Array, options?: CallOptions): Promise<KeyEntry[]> {
    const found: KeyEntry[] = [];
    let offset = 0;
    for (;;) {
      const page = await this.search({ descr, match: 'prefix', offset, limit: MAX_PAGE_SIZE }, options);
      found.push(...page.keys.filter((key) => key.descr !== undefined && bytesEqual(key.descr, descr)));
      offset += page.keys.length;
      if (page.keys.length === 0 || offset >= page.total) return found;
    }
  }
}

/** Operations of this module. */
export const KEYMGMT_OPERATIONS: readonly OperationSpec[] = [KEY_CREATE, KEY_GET, KEY_LIST, KEY_LIST_OFFSET, KEY_LIST_PAGE, KEY_SEARCH];
