/**
 * Cryptographic operations with stored keys: HMAC, AES key wrap and unwrap
 * (M1); HMAC verify, ECDSA/EdDSA sign and verify (M2). Every operation uses
 * the exact per-key scope `keymgmt:use:<kid>` and needs an `https:` device
 * URL.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateKid, validateMessage } from '../codec/validate.js';
import { HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { type BindingContext, type OperationSpec, invoke, readBase64 } from './core.js';
import { verified } from './verify.js';

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

export const CRYPTO_HMAC_VERIFY: OperationSpec = {
  name: 'crypto.hmacVerify',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/hmac/verify',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: [],
  emptyResponse: true,
};

export const CRYPTO_SIGN: OperationSpec = {
  name: 'crypto.sign',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/exdsa/sign',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['sign'],
};

export const CRYPTO_VERIFY: OperationSpec = {
  name: 'crypto.verify',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/exdsa/verify',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: [],
  emptyResponse: true,
};

/** Operations of this module. */
export const CRYPTO_OPERATIONS: readonly OperationSpec[] = [CRYPTO_HMAC, CRYPTO_WRAP, CRYPTO_UNWRAP, CRYPTO_HMAC_VERIFY, CRYPTO_SIGN, CRYPTO_VERIFY];

/** Largest MAC a verify accepts, in bytes (the longest digest, SHA-512). */
export const MAX_MAC_BYTES = 64;
/** Largest signature context, in bytes (RFC 8032). */
export const MAX_CONTEXT_BYTES = 255;

/**
 * Signature algorithms of {@link CryptoApi.sign} and {@link CryptoApi.verify}
 * (ref/api/hem-api-1.2.2.yaml): the ECDSA variants for `SECP*` keys, the
 * Ed25519 variants for `ED25519`, the Ed448 variants for `ED448`.
 */
export const SIGNATURE_ALGORITHMS = Object.freeze([
  'SHA256WithECDSA',
  'SHA384WithECDSA',
  'SHA512WithECDSA',
  'Ed25519',
  'Ed25519ph',
  'Ed25519ctx',
  'Ed448',
  'Ed448ph',
] as const);

/** A signature algorithm. */
export type SignatureAlgorithm = (typeof SIGNATURE_ALGORITHMS)[number];

/** The algorithms that take a context (RFC 8032 prehash and context variants). */
const CONTEXT_ALGORITHMS: readonly string[] = ['Ed25519ph', 'Ed25519ctx', 'Ed448', 'Ed448ph'];

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

/** Parameters of {@link CryptoApi.hmacVerify}. */
export interface HmacVerifyParams {
  /** Stored HMAC key (`SHA*` type); its type decides the hash. */
  kid: string;
  /** Message, 1 to 2048 bytes. */
  msg: Uint8Array;
  /** The MAC to check, 1 to 64 bytes. */
  mac: Uint8Array;
}

/** Parameters of {@link CryptoApi.sign}. */
export interface SignParams {
  /** Stored private signing key: a `SECP*` key created with the `ExDSA` mode, `ED25519` or `ED448`. */
  kid: string;
  /** Message, 1 to 2048 bytes; the device hashes it. */
  msg: Uint8Array;
  /** Algorithm; it must match the key's curve. */
  alg: SignatureAlgorithm;
  /** Context, at most 255 bytes; only with `Ed25519ph`, `Ed25519ctx`, `Ed448` and `Ed448ph`. */
  ctx?: Uint8Array | undefined;
}

/** Parameters of {@link CryptoApi.verify}. */
export interface VerifyParams extends SignParams {
  /** The signature to check: DER for ECDSA, raw for EdDSA. */
  sign: Uint8Array;
}

function signBody(params: SignParams): { kid: string; body: Record<string, unknown> } {
  const kid = validateKid(params?.kid);
  const msg = validateMessage(params.msg);
  if (!(SIGNATURE_ALGORITHMS as readonly string[]).includes(params.alg)) {
    throw new HemValidationError(`Invalid alg: must be one of ${SIGNATURE_ALGORITHMS.join(', ')}`, { parameter: 'alg' });
  }
  const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg), alg: params.alg };
  if (params.ctx !== undefined) {
    if (!(params.ctx instanceof Uint8Array) || params.ctx.length > MAX_CONTEXT_BYTES) {
      throw new HemValidationError(`Invalid ctx: must be at most ${MAX_CONTEXT_BYTES} bytes`, { parameter: 'ctx' });
    }
    if (!CONTEXT_ALGORITHMS.includes(params.alg)) {
      throw new HemValidationError(`Invalid ctx: ${params.alg} takes no context; use ${CONTEXT_ALGORITHMS.join(', ')}`, { parameter: 'ctx' });
    }
    body['ctx'] = bytesToBase64(params.ctx);
  }
  return { kid, body };
}

function requireNonEmptyBytes(value: unknown, parameter: string, max?: number): Uint8Array {
  if (!(value instanceof Uint8Array)) throw new HemValidationError(`Invalid ${parameter}: must be a Uint8Array`, { parameter });
  if (value.length === 0) throw new HemValidationError(`Invalid ${parameter}: must not be empty`, { parameter });
  if (max !== undefined && value.length > max) throw new HemValidationError(`Invalid ${parameter}: must be at most ${max} bytes`, { parameter });
  return value;
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
   * Check a MAC over a message with a stored key, on the device. Returns
   * `true` when the device accepts it and `false` when it reports a
   * mismatch (406) — which also covers a missing key or a key of the wrong
   * type, as the device does not tell these apart. Other failures raise.
   *
   * Device call: `POST /api/crypto/hmac/verify`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  hmacVerify(params: HmacVerifyParams, options?: CallOptions): Promise<boolean>;

  /**
   * Sign a message with a stored private key; the device hashes the message
   * itself. The signature is DER-encoded for the ECDSA algorithms and raw
   * for the EdDSA ones. A `SECP*` key signs only when it was created with
   * the `ExDSA` mode; otherwise, and for a missing key or an algorithm that
   * does not match the curve, the device answers 406
   * (`HemOperationFailedError`). A context is sent only with the `ph` and
   * `ctx` variants; giving one with another algorithm is refused.
   *
   * Device call: `POST /api/crypto/exdsa/sign`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  sign(params: SignParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Check a signature over a message with a stored key, on the device.
   * Returns `true` when the device accepts it and `false` when it reports
   * an invalid signature (406) — which also covers a missing key, a key of
   * the wrong type or an algorithm that does not match the curve. Other
   * failures raise. Same algorithm rules and encodings as {@link CryptoApi.sign}.
   *
   * Device call: `POST /api/crypto/exdsa/verify`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  verify(params: VerifyParams, options?: CallOptions): Promise<boolean>;

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

  // implements: REQ-OPS-005
  async hmacVerify(params: HmacVerifyParams, options?: CallOptions): Promise<boolean> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const mac = requireNonEmptyBytes(params.mac, 'mac', MAX_MAC_BYTES);
    // No alg: the stored key's type decides the hash (ARCHITECTURE.md §6 quirk 10).
    const body = { kid, msg: bytesToBase64(msg), mac: bytesToBase64(mac) };
    return verified(() => invoke(this.#context, CRYPTO_HMAC_VERIFY, { params: { kid }, body }, options));
  }

  // implements: REQ-OPS-006
  async sign(params: SignParams, options?: CallOptions): Promise<Uint8Array> {
    const { kid, body } = signBody(params);
    const r = await invoke(this.#context, CRYPTO_SIGN, { params: { kid }, body }, options);
    return readBase64(CRYPTO_SIGN, r, 'sign');
  }

  // implements: REQ-OPS-007
  async verify(params: VerifyParams, options?: CallOptions): Promise<boolean> {
    const { kid, body } = signBody(params);
    body['sign'] = bytesToBase64(requireNonEmptyBytes(params.sign, 'sign'));
    return verified(() => invoke(this.#context, CRYPTO_VERIFY, { params: { kid }, body }, options));
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
