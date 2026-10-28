/**
 * Key-management bindings: create and get; list and search; delete (M1);
 * update, import and derive (M2).
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateDescription, validateKid, validateLabel } from '../codec/validate.js';
import { HemDeviceError, HemOperationFailedError, HemProtocolError, HemValidationError, copyError } from '../errors.js';
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
import {
  DERIVABLE_KEY_TYPES,
  type DerivableKeyType,
  IMPORTABLE_KEY_TYPES,
  type ImportableKeyType,
  KEY_MODES,
  KEY_TYPES,
  type KeyMode,
  type KeyType,
  type KeyTypeInfo,
  parseKeyType,
} from './key-type.js';
import { type KeyPeer, peerFields, validatePubkey } from './peer.js';

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

export const KEY_DELETE: OperationSpec = {
  name: 'keys.delete',
  group: 'keymgmt',
  method: 'DELETE',
  path: '/api/keymgmt/delete/{kid}',
  scope: 'keymgmt:del',
  tlsOnly: true,
  required: [],
  emptyResponse: true,
};

export const KEY_UPDATE: OperationSpec = {
  name: 'keys.update',
  group: 'keymgmt',
  method: 'POST',
  path: '/api/keymgmt/update',
  scope: 'keymgmt:upd',
  tlsOnly: true,
  required: [],
  emptyResponse: true,
};

export const KEY_IMPORT: OperationSpec = {
  name: 'keys.import',
  group: 'keymgmt',
  method: 'POST',
  path: '/api/keymgmt/import',
  scope: 'keymgmt:imp',
  tlsOnly: true,
  required: ['kid'],
};

export const KEY_DERIVE: OperationSpec = {
  name: 'keys.derive',
  group: 'keymgmt',
  method: 'POST',
  path: '/api/keymgmt/derive',
  scope: 'keymgmt:gen',
  tlsOnly: true,
  required: ['kid'],
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
  /**
   * List: valid records in the repository. Search: as the device reports it —
   * firmware 1.2.2 was seen to report the repository's record count here, not
   * the number of matches, so page until a page comes back empty.
   */
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

function validateMode(mode: unknown): KeyMode {
  if (!(KEY_MODES as readonly string[]).includes(mode as string)) {
    throw new HemValidationError(`Invalid mode: must be exactly one of ${KEY_MODES.join(', ')}`, { parameter: 'mode' });
  }
  return mode as KeyMode;
}

/**
 * The `mode` to send with a key type: the caller's, validated; else `ECDH`
 * for a `SECP*` type, because the device gives such a key no usage at all
 * without one (ARCHITECTURE.md §6 quirk 11); else none.
 */
// implements: REQ-KEY-001, REQ-KEY-008, REQ-KEY-009
function keyMode(type: string, mode: unknown): KeyMode | undefined {
  if (mode !== undefined) return validateMode(mode);
  return type.startsWith('SECP') ? 'ECDH' : undefined;
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
  /** Usage of a `SECP*` key: `ECDH`, `ExDSA`, or `ECDH,ExDSA`; `ECDH` when omitted. Not sent for other types. */
  mode?: KeyMode | undefined;
  /** Binary description, at most 64 bytes; searchable with `keys.search`. */
  descr?: Uint8Array | undefined;
}

/** Parameters of {@link KeysApi.update}. */
export interface UpdateKeyParams {
  /** Key id, 32 hexadecimal characters. */
  kid: string;
  /** New label, 1 to 32 printable ASCII characters; always required. */
  label: string;
  /** New description, at most 64 bytes. An empty array clears the description. */
  descr: Uint8Array;
}

/** Parameters of {@link KeysApi.import}. */
export interface ImportKeyParams {
  /** 1 to 32 printable ASCII characters. */
  label: string;
  /** The public key: compressed X9.63 for `SECP*` types, raw bytes for the others. */
  pubkey: Uint8Array;
  /** Key type of the public key; asymmetric types only. */
  type: ImportableKeyType;
  /** Usage of a `SECP*` key: `ECDH`, `ExDSA`, or `ECDH,ExDSA`; `ECDH` when omitted. Not sent for other types. */
  mode?: KeyMode | undefined;
  /** Binary description, at most 64 bytes. */
  descr?: Uint8Array | undefined;
}

/** Parameters of {@link KeysApi.derive}. */
export interface DeriveKeyParams {
  /** Stored private key capable of ECDH; the source of the derivation. */
  kid: string;
  /** Label of the new key, 1 to 32 printable ASCII characters. */
  label: string;
  /** Type of the new key: any creatable type except the post-quantum ones. */
  type: DerivableKeyType;
  /** The peer public key: a stored key id or raw bytes. */
  peer: KeyPeer;
  /** Usage of a `SECP*` target: `ECDH`, `ExDSA`, or `ECDH,ExDSA`; `ECDH` when omitted. Not sent for other types. */
  mode?: KeyMode | undefined;
  /** Binary description of the new key, at most 64 bytes. */
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
export interface KeysApi {
  /**
   * Generate a key on the device and return its key id (32 lower-case hex
   * characters). The key material never leaves the device.
   *
   * A `SECP*` key is created with mode `ECDH` unless `mode` is given: the
   * device grants a key created without a mode no usage at all (it can
   * neither sign nor run ECDH). A `SECP*` key signs only when its mode
   * includes `ExDSA`. The mode literals are exact (`ExDSA,ECDH` is
   * rejected). Generating a post-quantum key (`MLKEM*`, `MLDSA*`) can take
   * longer than the default 30 s limit; pass a larger `timeoutMs` for it.
   *
   * Device call: `POST /api/keymgmt/create`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:gen`. Introduced in M1.
   */
  create(params: CreateKeyParams, options?: CallOptions): Promise<string>;

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
  get(kid: string, options?: CallOptions): Promise<KeyDetails>;

  /**
   * Delete one key: the device marks its record as deleted. A key id that
   * is not present raises `HemOperationFailedError` (406). A paired mobile
   * app is stored as a key, so this is also how a pairing is removed. The
   * cached `keymgmt:use:<kid>` token of the deleted key is discarded.
   *
   * Device call: `DELETE /api/keymgmt/delete/{kid}`. HTTPS only — over
   * plain HTTP the device would answer 409 rather than 418; the client
   * refuses before sending either way.
   *
   * @remarks Token scope: `keymgmt:del`. Introduced in M1.
   */
  delete(kid: string, options?: CallOptions): Promise<void>;

  /**
   * Change a key's label and description. The device rewrites the whole
   * record, so both are stated: `descr` is the new description, and an
   * empty array clears it (the field is then left out of the request, which
   * is how the device clears it). An unknown key id raises
   * `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/keymgmt/update`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:upd`. Introduced in M2.
   */
  update(params: UpdateKeyParams, options?: CallOptions): Promise<void>;

  /**
   * Store an external public key and return its key id (32 lower-case hex
   * characters). Asymmetric types only; `SECP*` keys are given in
   * compressed X9.63 form, the others raw. The key id is derived from the
   * key material, so importing the same key again is refused with
   * `HemOperationFailedError` (406) — as are an unknown type and a key of
   * the wrong length. The library applies no size limit of its own to the
   * key beyond the 7300-byte request body. A `SECP*` key is imported with
   * mode `ECDH` unless `mode` is given; without a mode the device stores a
   * key that cannot serve as an ECDH peer.
   *
   * Device call: `POST /api/keymgmt/import`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:imp`. Introduced in M2.
   */
  import(params: ImportKeyParams, options?: CallOptions): Promise<string>;

  /**
   * Derive a new stored key from a stored private key and a peer public
   * key: the device runs ECDH, then HKDF-SHA256, and stores the result.
   * Returns the new key id. The derivation cannot be reproduced outside the
   * device, and deriving the same key again is refused with
   * `HemOperationFailedError` (406), as is a source key that is missing or
   * not ECDH-capable. Post-quantum target types are not supported.
   * Firmware 1.2.2 answers an unrecognised target type with the source key
   * id and creates nothing; the type is checked before sending, and such a
   * reply raises `HemProtocolError`. A `SECP*` target gets mode `ECDH`
   * unless `mode` is given; firmware 1.2.2 refuses every `SECP*` target
   * with 406 (ARCHITECTURE.md §6 quirk 21).
   *
   * Device call: `POST /api/keymgmt/derive`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:gen`. Introduced in M2.
   */
  derive(params: DeriveKeyParams, options?: CallOptions): Promise<string>;

  /**
   * One page of the key repository, at most 15 keys. Labels and
   * descriptions are available here (key get does not return them).
   *
   * Device calls: `GET /api/keymgmt/list`, `/list/{offset}` or
   * `/list/{offset}/{count}`, chosen from the parameters. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:list`. Introduced in M1.
   */
  list(params?: ListKeysParams, options?: CallOptions): Promise<KeyPage>;

  /**
   * Every key in the repository, page by page. Stops when the offset
   * reaches the reported total or a page comes back empty — not when a page
   * is merely short.
   *
   * @remarks Token scope: `keymgmt:list`. Introduced in M1.
   */
  listAll(options?: CallOptions): Promise<KeyEntry[]>;

  /**
   * Find keys by their description. The needle is sent as base64 with a
   * leading `^` (prefix) or a trailing `$` (suffix); firmware 1.2.2 compares
   * the decoded bytes, so a needle of any length matches at any byte offset
   * (verified on the device in M1B). For an exact match use
   * {@link KeysApi.findByDescription}. No match gives an empty page (also
   * for the 404 of older firmware); the page's `total` is then not 0 on
   * firmware 1.2.2 — see {@link KeyPage.total}.
   *
   * Device call: `POST /api/keymgmt/search`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:search`. Introduced in M1.
   */
  search(params: SearchKeysParams, options?: CallOptions): Promise<KeyPage>;

  /**
   * The keys whose description equals `descr` exactly: a prefix search over
   * all result pages, filtered byte for byte.
   *
   * @remarks Token scope: `keymgmt:search`. Introduced in M1.
   */
  findByDescription(descr: Uint8Array, options?: CallOptions): Promise<KeyEntry[]>;
}

/** @internal Implementation of {@link KeysApi}. */
export class KeysApiImpl implements KeysApi {
  readonly #context: BindingContext;

  /** @internal */
  constructor(context: BindingContext) {
    this.#context = context;
  }

  // implements: REQ-KEY-001
  async create(params: CreateKeyParams, options?: CallOptions): Promise<string> {
    const label = validateLabel(params?.label);
    if (!(KEY_TYPES as readonly string[]).includes(params.type)) {
      throw new HemValidationError(`Invalid type: must be one of ${KEY_TYPES.join(', ')}`, { parameter: 'type' });
    }
    const body: Record<string, unknown> = { label, type: params.type };
    const mode = keyMode(params.type, params.mode);
    if (mode !== undefined) body['mode'] = mode;
    if (params.descr !== undefined) body['descr'] = bytesToBase64(validateDescription(params.descr));
    const r = await invoke(this.#context, KEY_CREATE, { body }, options);
    return readKid(KEY_CREATE, r);
  }

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

  // implements: REQ-KEY-007
  async delete(kid: string, options?: CallOptions): Promise<void> {
    const id = validateKid(kid);
    await invoke(this.#context, KEY_DELETE, { params: { kid: id } }, options);
    // The key is gone, so a token scoped to it is useless.
    this.#context.tokens.forget(`keymgmt:use:${id}`);
  }

  // implements: REQ-KEY-006
  async update(params: UpdateKeyParams, options?: CallOptions): Promise<void> {
    const kid = validateKid(params?.kid);
    const label = validateLabel(params.label);
    const descr = validateDescription(params.descr);
    const body: Record<string, unknown> = { kid, label };
    // The device clears the description when the field is absent (ARCHITECTURE.md §6 quirk 5).
    if (descr.length > 0) body['descr'] = bytesToBase64(descr);
    await invoke(this.#context, KEY_UPDATE, { body }, options);
  }

  // implements: REQ-KEY-008
  async import(params: ImportKeyParams, options?: CallOptions): Promise<string> {
    const label = validateLabel(params?.label);
    const pubkey = validatePubkey(params.pubkey);
    if (!(IMPORTABLE_KEY_TYPES as readonly string[]).includes(params.type)) {
      throw new HemValidationError(`Invalid type: must be an asymmetric type, one of ${IMPORTABLE_KEY_TYPES.join(', ')}`, { parameter: 'type' });
    }
    const body: Record<string, unknown> = { label, pubkey: bytesToBase64(pubkey), type: params.type };
    const mode = keyMode(params.type, params.mode);
    if (mode !== undefined) body['mode'] = mode;
    if (params.descr !== undefined) body['descr'] = bytesToBase64(validateDescription(params.descr));
    try {
      return readKid(KEY_IMPORT, await invoke(this.#context, KEY_IMPORT, { body }, options));
    } catch (error) {
      if (error instanceof HemOperationFailedError) {
        throw copyError(error, {}, `${error.message}: unknown type, wrong key length, a duplicate of a key already stored, or a repository failure`);
      }
      throw error;
    }
  }

  // implements: REQ-KEY-009
  async derive(params: DeriveKeyParams, options?: CallOptions): Promise<string> {
    const kid = validateKid(params?.kid);
    const label = validateLabel(params.label);
    if (!(DERIVABLE_KEY_TYPES as readonly string[]).includes(params.type)) {
      throw new HemValidationError(`Invalid type: must be one of ${DERIVABLE_KEY_TYPES.join(', ')}`, { parameter: 'type' });
    }
    const body: Record<string, unknown> = { kid, label, type: params.type, ...peerFields(params.peer) };
    const mode = keyMode(params.type, params.mode);
    if (mode !== undefined) body['mode'] = mode;
    if (params.descr !== undefined) body['descr'] = bytesToBase64(validateDescription(params.descr));
    const derived = readKid(KEY_DERIVE, await invoke(this.#context, KEY_DERIVE, { body }, options));
    // Firmware 1.2.2 echoes the source key id for an unrecognised type without creating a key (ARCHITECTURE.md §6 quirk 4).
    if (derived === kid) {
      throw new HemProtocolError(`${KEY_DERIVE.name}: the device returned the source key id; no key was derived`, { operation: KEY_DERIVE.name });
    }
    return derived;
  }

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
export const KEYMGMT_OPERATIONS: readonly OperationSpec[] = [KEY_CREATE, KEY_GET, KEY_LIST, KEY_LIST_OFFSET, KEY_LIST_PAGE, KEY_SEARCH, KEY_DELETE, KEY_UPDATE, KEY_IMPORT, KEY_DERIVE];
