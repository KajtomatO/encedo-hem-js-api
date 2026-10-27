/**
 * Cryptographic operations with stored keys: HMAC, AES key wrap and unwrap
 * (M1); HMAC verify, ECDSA/EdDSA sign and verify, AES encrypt and decrypt,
 * ECDH, the ECDH-agreed key mode of the symmetric operations, ML-KEM
 * encapsulation and decapsulation, ML-DSA sign and verify (M2). Every
 * operation uses
 * the exact per-key scope `keymgmt:use:<kid>` and needs an `https:` device
 * URL.
 *
 * @packageDocumentation
 */
import { bytesToBase64 } from '../codec/base64.js';
import { validateKid, validateMessage } from '../codec/validate.js';
import { HemError, HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { type BindingContext, type OperationSpec, invoke, optional, readBase64, readString } from './core.js';
import { type KeyPeer, peerFields } from './peer.js';
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

export const CRYPTO_ENCRYPT: OperationSpec = {
  name: 'crypto.encrypt',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/cipher/encrypt',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['ciphertext'],
};

export const CRYPTO_DECRYPT: OperationSpec = {
  name: 'crypto.decrypt',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/cipher/decrypt',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['plaintext'],
};

export const CRYPTO_ECDH: OperationSpec = {
  name: 'crypto.ecdh',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/ecdh',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['ecdh'],
};

export const CRYPTO_MLKEM_ENCAPS: OperationSpec = {
  name: 'crypto.mlkemEncaps',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/pqc/mlkem/encaps',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['alg', 'ss', 'ct'],
};

export const CRYPTO_MLKEM_DECAPS: OperationSpec = {
  name: 'crypto.mlkemDecaps',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/pqc/mlkem/decaps',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  // `alg` is documented as required but holds an unrelated string on firmware 1.2.2 (quirk 2); it is neither required nor read.
  required: ['ss'],
};

export const CRYPTO_MLDSA_SIGN: OperationSpec = {
  name: 'crypto.mldsaSign',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/pqc/mldsa/sign',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: ['alg', 'sign'],
};

export const CRYPTO_MLDSA_VERIFY: OperationSpec = {
  name: 'crypto.mldsaVerify',
  group: 'crypto',
  method: 'POST',
  path: '/api/crypto/pqc/mldsa/verify',
  scope: 'keymgmt:use:{kid}',
  tlsOnly: true,
  required: [],
  emptyResponse: true,
};

/** Operations of this module. */
export const CRYPTO_OPERATIONS: readonly OperationSpec[] = [
  CRYPTO_MLKEM_ENCAPS,
  CRYPTO_MLKEM_DECAPS,
  CRYPTO_MLDSA_SIGN,
  CRYPTO_MLDSA_VERIFY,
  CRYPTO_ECDH,
  CRYPTO_HMAC,
  CRYPTO_WRAP,
  CRYPTO_UNWRAP,
  CRYPTO_HMAC_VERIFY,
  CRYPTO_SIGN,
  CRYPTO_VERIFY,
  CRYPTO_ENCRYPT,
  CRYPTO_DECRYPT,
];

/** Hash algorithms: the HMAC digest in the agreed-key mode, and the optional digest of an ECDH secret (ref/api/hem-api-1.2.2.yaml). */
export const HASH_ALGORITHMS = Object.freeze(['SHA2-256', 'SHA2-384', 'SHA2-512', 'SHA3-256', 'SHA3-384', 'SHA3-512'] as const);

/** A hash algorithm. */
export type HashAlgorithm = (typeof HASH_ALGORITHMS)[number];

/** Largest HKDF context suffix of the agreed-key mode, in bytes. */
export const MAX_HKDF_CONTEXT_BYTES = 64;

/**
 * The agreed-key mode of a symmetric operation (ARCHITECTURE.md §6): the
 * device runs ECDH between the stored key `kid` and `peer`, and uses the
 * result as the working key — directly for HMAC, through HKDF-SHA256 for
 * the cipher and wrap operations, where an optional `ctx` of up to 64
 * bytes is appended to the HKDF info.
 */
export interface AgreedKeyParams {
  /** The peer public key; its presence selects the agreed-key mode. */
  peer?: KeyPeer | undefined;
  /** HKDF context suffix, at most 64 bytes; cipher and wrap operations in the agreed-key mode only. */
  ctx?: Uint8Array | undefined;
}

function validateHash(alg: unknown): HashAlgorithm {
  if (!(HASH_ALGORITHMS as readonly string[]).includes(alg as string)) {
    throw new HemValidationError(`Invalid alg: must be one of ${HASH_ALGORITHMS.join(', ')}`, { parameter: 'alg' });
  }
  return alg as HashAlgorithm;
}

/**
 * Add the agreed-key fields to a body: `ext_kid` or `pubkey` from `peer`,
 * and `ctx` when the operation derives through HKDF. Without a peer, a
 * context is refused.
 */
// implements: REQ-OPS-015
function addAgreedKey(body: Record<string, unknown>, params: AgreedKeyParams, hkdf: boolean): boolean {
  if (params.peer === undefined) {
    if (params.ctx !== undefined) throw new HemValidationError('Invalid ctx: a context applies to the agreed-key mode only; give a peer', { parameter: 'ctx' });
    return false;
  }
  Object.assign(body, peerFields(params.peer));
  if (params.ctx !== undefined) {
    if (!hkdf) throw new HemValidationError('Invalid ctx: HMAC has no HKDF context', { parameter: 'ctx' });
    if (!(params.ctx instanceof Uint8Array) || params.ctx.length > MAX_HKDF_CONTEXT_BYTES) {
      throw new HemValidationError(`Invalid ctx: must be at most ${MAX_HKDF_CONTEXT_BYTES} bytes`, { parameter: 'ctx' });
    }
    body['ctx'] = bytesToBase64(params.ctx);
  }
  return true;
}

/** HMAC body: `alg` is required with a peer (the raw ECDH secret is the key) and refused without one (the stored key's type decides). */
function addHmacMode(body: Record<string, unknown>, params: AgreedKeyParams & { alg?: HashAlgorithm | undefined }): void {
  const agreed = addAgreedKey(body, params, false);
  if (agreed) {
    if (params.alg === undefined) throw new HemValidationError('Invalid alg: the agreed-key mode of HMAC needs a hash algorithm', { parameter: 'alg' });
    body['alg'] = validateHash(params.alg);
  } else if (params.alg !== undefined) {
    // ARCHITECTURE.md §6 quirk 10: with a stored key the device ignores alg; refusing it keeps callers from relying on it.
    throw new HemValidationError('Invalid alg: with a stored key its type decides the hash; alg applies to the agreed-key mode only', { parameter: 'alg' });
  }
}

/** ML-KEM ciphertext sizes in bytes, by parameter set (FIPS 203; ref/api/hem-api-1.2.2.yaml). */
export const MLKEM_CIPHERTEXT_BYTES = Object.freeze({ MLKEM512: 768, MLKEM768: 1088, MLKEM1024: 1568 } as const);
/** ML-DSA signature sizes in bytes, by parameter set (FIPS 204; ref/api/hem-api-1.2.2.yaml). */
export const MLDSA_SIGNATURE_BYTES = Object.freeze({ MLDSA44: 2420, MLDSA65: 3309, MLDSA87: 4627 } as const);
/** The shared secret of ML-KEM, in bytes. */
export const MLKEM_SHARED_SECRET_BYTES = 32;

/** Parameters of {@link CryptoApi.mlkemEncaps}. */
export interface MlkemEncapsParams {
  /** Stored ML-KEM key (device-generated). */
  kid: string;
}

/** Result of {@link CryptoApi.mlkemEncaps}. */
export interface MlkemEncapsulation {
  /** Parameter-set name as the device reports it: `MLKEM512`, `MLKEM768` or `MLKEM1024`. */
  readonly alg: string;
  /** The 32-byte shared secret. */
  readonly sharedSecret: Uint8Array;
  /** The ciphertext to hand to the key's holder: 768, 1088 or 1568 bytes. */
  readonly ciphertext: Uint8Array;
}

/** Parameters of {@link CryptoApi.mlkemDecaps}. */
export interface MlkemDecapsParams {
  /** Stored ML-KEM private key. */
  kid: string;
  /** Ciphertext from encapsulation; exactly 768, 1088 or 1568 bytes. */
  ct: Uint8Array;
}

/** Parameters of {@link CryptoApi.mldsaSign}. */
export interface MldsaSignParams {
  /** Stored ML-DSA private key. */
  kid: string;
  /** Message, 1 to 2048 bytes. */
  msg: Uint8Array;
  /** Context, at most 255 bytes; the same context must be given at verification. */
  ctx?: Uint8Array | undefined;
}

/** Result of {@link CryptoApi.mldsaSign}. */
export interface MldsaSignature {
  /** Parameter-set name as the device reports it: `MLDSA44`, `MLDSA65` or `MLDSA87`. */
  readonly alg: string;
  /** The signature: 2420, 3309 or 4627 bytes. */
  readonly signature: Uint8Array;
}

/** Parameters of {@link CryptoApi.mldsaVerify}. */
export interface MldsaVerifyParams extends MldsaSignParams {
  /** The signature to check, at most 4627 bytes. */
  sign: Uint8Array;
}

const MLKEM_CIPHERTEXT_SIZES: readonly number[] = Object.values(MLKEM_CIPHERTEXT_BYTES);

/**
 * ML-DSA verify (ARCHITECTURE.md §6 quirk 3): a failed verification puts a
 * raw internal code into the HTTP status line, so any completed error
 * response other than an authentication or authorisation failure means
 * "invalid". A success or redirect status, and failures without a response
 * (validation, TLS guard, transport), are never "invalid".
 */
// implements: REQ-OPS-014
function isMldsaInvalid(error: unknown): boolean {
  if (!(error instanceof HemError) || error.status === undefined) return false;
  const { status } = error;
  if (status === 401 || status === 403) return false;
  return status < 200 || status >= 400;
}

function addPqcContext(body: Record<string, unknown>, ctx: unknown): void {
  if (ctx === undefined) return;
  if (!(ctx instanceof Uint8Array) || ctx.length > MAX_CONTEXT_BYTES) {
    throw new HemValidationError(`Invalid ctx: must be at most ${MAX_CONTEXT_BYTES} bytes`, { parameter: 'ctx' });
  }
  body['ctx'] = bytesToBase64(ctx);
}

/** AES block size; also the IV, nonce and GCM tag size the device uses. */
export const AES_BLOCK_BYTES = 16;

/** Cipher algorithms of {@link CryptoApi.encrypt} and {@link CryptoApi.decrypt}: key size and mode (ref/api/hem-api-1.2.2.yaml). */
export const CIPHER_ALGORITHMS = Object.freeze([
  'AES128-ECB',
  'AES128-CBC',
  'AES128-GCM',
  'AES192-ECB',
  'AES192-CBC',
  'AES192-GCM',
  'AES256-ECB',
  'AES256-CBC',
  'AES256-GCM',
] as const);

/** A cipher algorithm. */
export type CipherAlgorithm = (typeof CIPHER_ALGORITHMS)[number];

/** A cipher mode. */
export type CipherMode = 'ECB' | 'CBC' | 'GCM';

function cipherMode(alg: unknown): CipherMode {
  if (!(CIPHER_ALGORITHMS as readonly string[]).includes(alg as string)) {
    throw new HemValidationError(`Invalid alg: must be one of ${CIPHER_ALGORITHMS.join(', ')}`, { parameter: 'alg' });
  }
  return (alg as string).slice(-3) as CipherMode;
}

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
  /** The peer public key; its presence selects the agreed-key mode (see {@link AgreedKeyParams}). */
  peer?: KeyPeer | undefined;
  /** Not used by HMAC: a context is refused. Present so one helper validates every agreed-key operation. */
  ctx?: undefined;
  /** Stored HMAC key (`SHA*` type); its type decides the hash. In the agreed-key mode, the stored ECDH private key. */
  kid: string;
  /** Message, 1 to 2048 bytes. */
  msg: Uint8Array;
  /** Hash algorithm; required in the agreed-key mode, refused with a stored key (its type decides). */
  alg?: HashAlgorithm | undefined;
}

/** Parameters of {@link CryptoApi.ecdh}. */
export interface EcdhParams {
  /** Stored ECDH-capable private key. */
  kid: string;
  /** The peer public key: a stored key id or raw bytes. */
  peer: KeyPeer;
  /** Digest to apply to the secret; without one the raw secret is returned. */
  alg?: HashAlgorithm | undefined;
}

/** Parameters of {@link CryptoApi.wrap} and {@link CryptoApi.unwrap}. */
export interface WrapParams {
  /** The peer public key; its presence selects the agreed-key mode (see {@link AgreedKeyParams}). */
  peer?: KeyPeer | undefined;
  /** HKDF context suffix, at most 64 bytes; agreed-key mode only. */
  ctx?: Uint8Array | undefined;
  /** Stored AES key used as the key-encryption key. In the agreed-key mode, the stored ECDH private key. */
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
  /** The peer public key; its presence selects the agreed-key mode (see {@link AgreedKeyParams}). */
  peer?: KeyPeer | undefined;
  /** Not used by HMAC: a context is refused. Present so one helper validates every agreed-key operation. */
  ctx?: undefined;
  /** Stored HMAC key (`SHA*` type); its type decides the hash. In the agreed-key mode, the stored ECDH private key. */
  kid: string;
  /** Message, 1 to 2048 bytes. */
  msg: Uint8Array;
  /** The MAC to check, 1 to 64 bytes. */
  mac: Uint8Array;
  /** Hash algorithm; required in the agreed-key mode, refused with a stored key (its type decides). */
  alg?: HashAlgorithm | undefined;
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

/** Parameters of {@link CryptoApi.encrypt}. */
export interface EncryptParams {
  /** The peer public key; its presence selects the agreed-key mode (see {@link AgreedKeyParams}). */
  peer?: KeyPeer | undefined;
  /** HKDF context suffix, at most 64 bytes; agreed-key mode only. */
  ctx?: Uint8Array | undefined;
  /** Stored AES key whose size matches `alg`. In the agreed-key mode, the stored ECDH private key. */
  kid: string;
  /** Plaintext, 1 to 2048 bytes; for ECB a multiple of 16 bytes. */
  msg: Uint8Array;
  /** Key size and mode. */
  alg: CipherAlgorithm;
  /** Additional authenticated data; GCM only. */
  aad?: Uint8Array | undefined;
}

/** Result of {@link CryptoApi.encrypt}: everything decryption needs besides the key. */
export interface EncryptResult {
  readonly ciphertext: Uint8Array;
  /** The 16-byte IV (CBC) or nonce (GCM) the device generated; absent for ECB. */
  readonly iv?: Uint8Array;
  /** The 16-byte authentication tag; GCM only. */
  readonly tag?: Uint8Array;
}

/** Parameters of {@link CryptoApi.decrypt}. */
export interface DecryptParams {
  /** The peer public key; its presence selects the agreed-key mode (see {@link AgreedKeyParams}). */
  peer?: KeyPeer | undefined;
  /** HKDF context suffix, at most 64 bytes; agreed-key mode only. */
  ctx?: Uint8Array | undefined;
  /** Stored AES key whose size matches `alg`. In the agreed-key mode, the stored ECDH private key. */
  kid: string;
  /** Ciphertext; for ECB a multiple of 16 bytes. */
  msg: Uint8Array;
  /** Key size and mode, as used for encryption. */
  alg: CipherAlgorithm;
  /** The 16-byte IV or nonce returned by encryption; required for CBC and GCM. */
  iv?: Uint8Array | undefined;
  /** The 16-byte authentication tag returned by encryption; required for GCM. */
  tag?: Uint8Array | undefined;
  /** The additional authenticated data given to encryption; GCM only. */
  aad?: Uint8Array | undefined;
}

function requireBlockAligned(msg: Uint8Array, parameter = 'msg'): void {
  if (msg.length % AES_BLOCK_BYTES !== 0) throw new HemValidationError(`Invalid ${parameter}: ECB input must be a multiple of ${AES_BLOCK_BYTES} bytes`, { parameter });
}

function requireExactBytes(value: unknown, parameter: string, length: number): Uint8Array {
  if (!(value instanceof Uint8Array) || value.length !== length) throw new HemValidationError(`Invalid ${parameter}: must be exactly ${length} bytes`, { parameter });
  return value;
}

/** Add `aad` to a body when given, refusing it outside GCM. */
function addAad(body: Record<string, unknown>, aad: unknown, mode: CipherMode): void {
  if (aad === undefined) return;
  if (mode !== 'GCM') throw new HemValidationError('Invalid aad: additional authenticated data applies to GCM only', { parameter: 'aad' });
  if (!(aad instanceof Uint8Array)) throw new HemValidationError('Invalid aad: must be a Uint8Array', { parameter: 'aad' });
  body['aad'] = bytesToBase64(aad);
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
  addAgreedKey(body, params, true);
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
   * Agreed-key mode (M2): with `peer`, `kid` is a stored ECDH private key,
   * the raw ECDH secret with the peer is the HMAC key, and `alg` chooses
   * the hash (required). The token scope is still that of `kid`.
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
   * The agreed-key mode (`peer`, `alg`) is as for {@link CryptoApi.hmac}.
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
   * Encrypt with a stored AES key in ECB, CBC or GCM mode. The device
   * generates the 16-byte IV (CBC) or nonce (GCM) itself and returns it;
   * GCM also returns a 16-byte tag. CBC input is padded by the device; ECB
   * input must be a multiple of 16 bytes. A missing key, a key of another
   * size or type, or an encryption failure raises `HemOperationFailedError`
   * (406).
   *
   * Agreed-key mode (M2): with `peer`, `kid` is a stored ECDH private key
   * and the AES key is derived on the device by HKDF-SHA256 from the ECDH
   * secret with the info `encedo-aes` plus the optional `ctx` (up to 64
   * bytes). Decrypt with the same pair and context.
   *
   * Device call: `POST /api/crypto/cipher/encrypt`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  encrypt(params: EncryptParams, options?: CallOptions): Promise<EncryptResult>;

  /**
   * Decrypt with a stored AES key in ECB, CBC or GCM mode, taking back the
   * IV and tag that {@link CryptoApi.encrypt} returned. CBC padding is
   * removed by the device. A decryption or GCM authentication failure, or
   * a wrong key, raises `HemOperationFailedError` (406). The agreed-key
   * mode (`peer`, `ctx`) is as for {@link CryptoApi.encrypt}.
   *
   * Device call: `POST /api/crypto/cipher/decrypt`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  decrypt(params: DecryptParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * Wrap key material with a stored AES key (RFC 3394 key wrap). The input
   * must be 16 to 2048 bytes and a multiple of 8; the result is 8 bytes
   * longer.
   *
   * Agreed-key mode (M2): with `peer`, `kid` is a stored ECDH private key
   * and the key-encryption key is derived on the device by HKDF-SHA256 from
   * the ECDH secret with the info `encedo-kek` plus the optional `ctx` (up
   * to 64 bytes).
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
   * (406). The agreed-key mode (`peer`, `ctx`) is as for {@link CryptoApi.wrap}.
   *
   * Device call: `POST /api/crypto/cipher/unwrap`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M1.
   */
  unwrap(params: WrapParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * ECDH shared secret between a stored private key and a peer public key
   * (a stored key id or raw bytes; a raw `SECP*` peer in compressed X9.63
   * form, a stored `SECP*` peer imported with mode `ECDH`). A `SECP*`
   * private key must have been created with mode `ECDH`. Without `alg` the
   * device returns the raw secret, reported as 32 bytes even for larger
   * curves (firmware 1.2.2 truncates it: verified for P-384 and Curve448);
   * with `alg` it returns the digest of the secret (32, 48 or 64 bytes). A
   * missing peer key, a key without the ECDH use or a failed derivation raises
   * `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/crypto/ecdh`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  ecdh(params: EcdhParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * ML-KEM encapsulation against a stored ML-KEM key: returns a fresh
   * 32-byte shared secret and the ciphertext (768, 1088 or 1568 bytes for
   * ML-KEM-512, -768 and -1024) that lets the key's holder recover it with
   * {@link CryptoApi.mlkemDecaps}. A missing key or a key that is not an
   * ML-KEM key raises `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/crypto/pqc/mlkem/encaps`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  mlkemEncaps(params: MlkemEncapsParams, options?: CallOptions): Promise<MlkemEncapsulation>;

  /**
   * ML-KEM decapsulation: the 32-byte shared secret for a ciphertext and a
   * stored ML-KEM private key. The ciphertext must be exactly the size of
   * the key's parameter set. The device's reply also carries an `alg`
   * field, which on firmware 1.2.2 holds an unrelated internal string; it
   * is not exposed. A missing key, a key of another type or a size mismatch
   * raises `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/crypto/pqc/mlkem/decaps`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  mlkemDecaps(params: MlkemDecapsParams, options?: CallOptions): Promise<Uint8Array>;

  /**
   * ML-DSA signature (FIPS 204) of a message with a stored ML-DSA private
   * key: 2420, 3309 or 4627 bytes for ML-DSA-44, -65 and -87. An optional
   * context of up to 255 bytes selects the context variant; verification
   * must present the same context. A missing key or a key that is not an
   * ML-DSA key raises `HemOperationFailedError` (406).
   *
   * Device call: `POST /api/crypto/pqc/mldsa/sign`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  mldsaSign(params: MldsaSignParams, options?: CallOptions): Promise<MldsaSignature>;

  /**
   * Check an ML-DSA signature with a stored ML-DSA key, on the device.
   * Returns `true` when the device accepts it. Firmware 1.2.2 reports a
   * failed verification with a raw internal code in the HTTP status line
   * rather than 406, so every completed response that is neither a
   * success nor an authentication (401) or authorisation (403) failure
   * gives `false` — including a missing key, a key of the wrong type and
   * an imported public-only key, which the device rejects. Failures without
   * a response (validation, transport) raise. The request must fit the
   * 7300-byte body limit: an ML-DSA-87 signature leaves room for roughly
   * 800 message bytes.
   *
   * Device call: `POST /api/crypto/pqc/mldsa/verify`. HTTPS only.
   *
   * @remarks Token scope: `keymgmt:use:<kid>`. Introduced in M2.
   */
  mldsaVerify(params: MldsaVerifyParams, options?: CallOptions): Promise<boolean>;
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
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg) };
    addHmacMode(body, params);
    const r = await invoke(this.#context, CRYPTO_HMAC, { params: { kid }, body }, options);
    return readBase64(CRYPTO_HMAC, r, 'mac');
  }

  // implements: REQ-OPS-005
  async hmacVerify(params: HmacVerifyParams, options?: CallOptions): Promise<boolean> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const mac = requireNonEmptyBytes(params.mac, 'mac', MAX_MAC_BYTES);
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg), mac: bytesToBase64(mac) };
    addHmacMode(body, params);
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

  // implements: REQ-OPS-008
  async encrypt(params: EncryptParams, options?: CallOptions): Promise<EncryptResult> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const mode = cipherMode(params.alg);
    if (mode === 'ECB') requireBlockAligned(msg);
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg), alg: params.alg };
    addAad(body, params.aad, mode);
    addAgreedKey(body, params, true);
    const spec = CRYPTO_ENCRYPT;
    const r = await invoke(this.#context, spec, { params: { kid }, body }, options);
    const result: { -readonly [K in keyof EncryptResult]: EncryptResult[K] } = { ciphertext: readBase64(spec, r, 'ciphertext') };
    // The IV and tag are required where the mode produces them; the device may send them anyway.
    const iv = mode === 'ECB' ? optional(readBase64, spec, r, 'iv') : readBase64(spec, r, 'iv');
    if (iv !== undefined) result.iv = iv;
    const tag = mode === 'GCM' ? readBase64(spec, r, 'tag') : optional(readBase64, spec, r, 'tag');
    if (tag !== undefined) result.tag = tag;
    return result;
  }

  // implements: REQ-OPS-009
  async decrypt(params: DecryptParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    const msg = requireNonEmptyBytes(params.msg, 'msg');
    const mode = cipherMode(params.alg);
    if (mode === 'ECB') requireBlockAligned(msg);
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg), alg: params.alg };
    if (mode === 'ECB') {
      if (params.iv !== undefined) throw new HemValidationError('Invalid iv: ECB takes no IV', { parameter: 'iv' });
    } else {
      if (params.iv === undefined) throw new HemValidationError(`Invalid iv: ${mode} needs the 16-byte IV returned by encryption`, { parameter: 'iv' });
      body['iv'] = bytesToBase64(requireExactBytes(params.iv, 'iv', AES_BLOCK_BYTES));
    }
    if (mode === 'GCM') {
      if (params.tag === undefined) throw new HemValidationError('Invalid tag: GCM needs the 16-byte tag returned by encryption', { parameter: 'tag' });
      body['tag'] = bytesToBase64(requireExactBytes(params.tag, 'tag', AES_BLOCK_BYTES));
    } else if (params.tag !== undefined) {
      throw new HemValidationError(`Invalid tag: ${mode} has no authentication tag`, { parameter: 'tag' });
    }
    addAad(body, params.aad, mode);
    addAgreedKey(body, params, true);
    const r = await invoke(this.#context, CRYPTO_DECRYPT, { params: { kid }, body }, options);
    return readBase64(CRYPTO_DECRYPT, r, 'plaintext');
  }

  // implements: REQ-OPS-010
  async ecdh(params: EcdhParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    const body: Record<string, unknown> = { kid, ...peerFields(params.peer) };
    if (params.alg !== undefined) body['alg'] = validateHash(params.alg);
    const r = await invoke(this.#context, CRYPTO_ECDH, { params: { kid }, body }, options);
    return readBase64(CRYPTO_ECDH, r, 'ecdh');
  }

  // implements: REQ-OPS-011
  async mlkemEncaps(params: MlkemEncapsParams, options?: CallOptions): Promise<MlkemEncapsulation> {
    const kid = validateKid(params?.kid);
    const spec = CRYPTO_MLKEM_ENCAPS;
    const r = await invoke(this.#context, spec, { params: { kid }, body: { kid } }, options);
    return { alg: readString(spec, r, 'alg'), sharedSecret: readBase64(spec, r, 'ss'), ciphertext: readBase64(spec, r, 'ct') };
  }

  // implements: REQ-OPS-012
  async mlkemDecaps(params: MlkemDecapsParams, options?: CallOptions): Promise<Uint8Array> {
    const kid = validateKid(params?.kid);
    if (!(params.ct instanceof Uint8Array)) throw new HemValidationError('Invalid ct: must be a Uint8Array', { parameter: 'ct' });
    if (!MLKEM_CIPHERTEXT_SIZES.includes(params.ct.length)) {
      throw new HemValidationError(`Invalid ct: an ML-KEM ciphertext is ${MLKEM_CIPHERTEXT_SIZES.join(', ')} bytes`, { parameter: 'ct' });
    }
    const r = await invoke(this.#context, CRYPTO_MLKEM_DECAPS, { params: { kid }, body: { kid, ct: bytesToBase64(params.ct) } }, options);
    // Only the secret: the alg field is unreliable on firmware 1.2.2 (quirk 2).
    return readBase64(CRYPTO_MLKEM_DECAPS, r, 'ss');
  }

  // implements: REQ-OPS-013
  async mldsaSign(params: MldsaSignParams, options?: CallOptions): Promise<MldsaSignature> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg) };
    addPqcContext(body, params.ctx);
    const spec = CRYPTO_MLDSA_SIGN;
    const r = await invoke(this.#context, spec, { params: { kid }, body }, options);
    return { alg: readString(spec, r, 'alg'), signature: readBase64(spec, r, 'sign') };
  }

  // implements: REQ-OPS-014
  async mldsaVerify(params: MldsaVerifyParams, options?: CallOptions): Promise<boolean> {
    const kid = validateKid(params?.kid);
    const msg = validateMessage(params.msg);
    const sign = requireNonEmptyBytes(params.sign, 'sign', MLDSA_SIGNATURE_BYTES.MLDSA87);
    const body: Record<string, unknown> = { kid, msg: bytesToBase64(msg), sign: bytesToBase64(sign) };
    addPqcContext(body, params.ctx);
    return verified(() => invoke(this.#context, CRYPTO_MLDSA_VERIFY, { params: { kid }, body }, options), isMldsaInvalid);
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
