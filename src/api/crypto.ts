/**
 * Cryptographic operations with stored keys (M1): HMAC, AES key wrap and
 * unwrap. Every operation uses the exact per-key scope `keymgmt:use:<kid>`
 * and needs an `https:` device URL.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateKid, validateMessage } from '../codec/validate.js';
import { HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { type BindingContext, type OperationSpec, invoke, readBase64 } from './core.js';

export const CRYPTO_HMAC: OperationSpec = {
  name: 'crypto.hmac',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/hmac/hash',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['mac'],
};

export const CRYPTO_WRAP: OperationSpec = {
  name: 'crypto.wrap',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/cipher/wrap',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['wrapped'],
};

export const CRYPTO_UNWRAP: OperationSpec = {
  name: 'crypto.unwrap',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/cipher/unwrap',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['unwrapped'],
};

/** Operations of this module. */
export const CRYPTO_OPERATIONS: readonly OperationSpec[] = [CRYPTO_HMAC, CRYPTO_WRAP, CRYPTO_UNWRAP];

/** Key-encryption-key size of a wrap or unwrap. */
export type WrapAlgorithm = 'AES128' | 'AES192' | 'AES256';

const WRAP_ALGORITHMS: readonly string[] = ['AES128', 'AES192', 'AES256'];

/** Parameters of {@link CryptoApi.hmac}. */
export interface HmacParams {
  /** Stored HMAC key (`SHA*` type); its type decides the hash. */
  kid: string;
  /** Message, 1 to 2048 bytes. */
  msg: Uint8Array;
}

/** Parameters of {@link CryptoApi.wrap} and {@link CryptoApi.unwrap}. */
export interface WrapParams {
  /** Stored AES key used as the key-encryption key. */
  kid: string;
  /** Data to wrap, or the wrapped blob to unwrap. */
  msg: Uint8Array;
  /** Key-encryption-key size; the device defaults to `AES256`. */
  alg?: WrapAlgorithm | undefined;
  /** Alternative 8-byte initial value instead of the RFC 3394 default. */
  iv?: Uint8Array | undefined;
}

function wrapBody(kid: string, msg: Uint8Array, params: WrapParams): Record<string, unknown> {
  const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg) };
  if (params.alg !== undefined) {
    if (!WRAP_ALGORITHMS.includes(params.alg)) throw new HemValidationError('Invalid alg: must be AES128, AES192 or AES256', { parameter: 'alg' });
    body['alg'] = params.alg;
  }
  if (params.iv !== undefined) {
    if (!(params.iv instanceof Uint8Array) || params.iv.length !== 8) throw new HemValidationError('Invalid iv: must be 8 bytes', { parameter: 'iv' });
    body['iv'] = bytesToBase64(params.iv);
  }
  return body;
}

function requireMultipleOf8(msg: Uint8Array, parameter = 'msg'): void {
  if (msg.length % 8 !== 0) throw new HemValidationError(`Invalid ${parameter}: length must be a multiple of 8 bytes`, { parameter });
}

/** `client.crypto`: operations with stored keys. */
export interface CryptoApi {
  /**
   * HMAC of a message with a stored key. The key's type decides the hash
   * (`SHA2-256` gives 32 bytes, and so on); no algorithm is sent, because
   * the device ignores it for a stored key. A missing key or a key of the
   * wrong type raises `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/crypto/hmac/hash`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M1.
   */
  hmac(params: HmacParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Wrap key material with a stored AES key (RFC 3394 key wrap). The input
   * must be 16 to 2048 bytes and a multiple of 8; the result is 8 bytes
   * longer.
   *
   * Device call: `POST /api/crypto/cipher/wrap`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M1.
   */
  wrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Unwrap key material wrapped by {@link CryptoApi.wrap} (RFC 3394). The
   * input must be a multiple of 8 bytes; the result is 8 bytes shorter. A
   * failed integrity check or a wrong key raises `HemOperationFailedError`
   * (406).
   *
   * Device call: `POST /api/crypto/cipher/unwrap`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M1.
   */
  unwrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array>;
}

/** @internal Implementation of {@link CryptoApi}. */
export class CryptoApiImpl implements CryptoApi {
  readonly #context: BindingContext;

  /** @internal */
  constructor(context: BindingContext) {
    this.#context = context;
  }

  // implements: REQ-OPS-001
  async hmac(params: HmacParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const r = await invoke(this.#context, CRYPTO_HMAC, { params: { kid }, body: { kid, msg: bytesToBase64(msg) } }, options);
    return readBase64(CRYPTO_HMAC, r, 'mac');
  }

  // implements: REQ-OPS-002
  async wrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    requireMultipleOf8(msg);
    if (msg.length < 16) throw new HemValidationError('Invalid msg: must be at least 16 bytes', { parameter: 'msg' });
    const r = await invoke(this.#context, CRYPTO_WRAP, { params: { kid }, body: wrapBody(kid, msg, params) }, options);
    return readBase64(CRYPTO_WRAP, r, 'wrapped');
  }

  // implements: REQ-OPS-003
  async unwrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    if (!(params.msg instanceof Uint8Array)) throw new HemValidationError('Invalid msg: must be a Uint8Array', { parameter: 'msg' });
    if (params.msg.length === 0) throw new HemValidationError('Invalid msg: must not be empty', { parameter: 'msg' });
    requireMultipleOf8(params.msg);
    const r = await invoke(this.#context, CRYPTO_UNWRAP, { params: { kid }, body: wrapBody(kid, params.msg, params) }, options);
    return readBase64(CRYPTO_UNWRAP, r, 'unwrapped');
  }
}
