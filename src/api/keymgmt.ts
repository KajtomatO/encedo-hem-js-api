/**
 * Key-management bindings (M1): create and get; list and search.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateDescription, validateKid, validateLabel } from '../codec/validate.js';
import { HemProtocolError, HemValidationError } from '../errors.js';
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
}

/** Operations of this module. */
export const KEYMGMT_OPERATIONS: readonly OperationSpec[] = [KEY_CREATE, KEY_GET];
