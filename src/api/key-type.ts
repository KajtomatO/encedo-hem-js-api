/**
 * Key types: the values accepted by key creation, and the parsing of the
 * `type` string the device reports.
 *
 * @packageDocumentation
 */

/** Key types that `keys.create` accepts (ref/api/hem-api-1.2.2.yaml). `SHA*` types are HMAC keys. */
export const KEY_TYPES = Object.freeze([
  'SECP256R1',
  'SECP384R1',
  'SECP521R1',
  'SECP256K1',
  'CURVE25519',
  'CURVE448',
  'ED25519',
  'ED448',
  'SHA2-256',
  'SHA2-384',
  'SHA2-512',
  'SHA3-256',
  'SHA3-384',
  'SHA3-512',
  'AES128',
  'AES192',
  'AES256',
  'MLKEM512',
  'MLKEM768',
  'MLKEM1024',
  'MLDSA44',
  'MLDSA65',
  'MLDSA87',
] as const);

/** A key type that can be created. */
export type KeyType = (typeof KEY_TYPES)[number];

/** Usage modes of `SECP*` keys; the literals are exact. */
export const KEY_MODES = Object.freeze(['ECDH', 'ExDSA', 'ECDH,ExDSA'] as const);

/** A key usage mode. */
export type KeyMode = (typeof KEY_MODES)[number];

/** Attribute flags that prefix the algorithm in a reported key type. */
export const KEY_FLAGS = Object.freeze(['ATT', 'PKEY', 'ECDH', 'ExDSA', 'CERT', 'PQC'] as const);

/** An attribute flag of a stored key. */
export type KeyFlag = (typeof KEY_FLAGS)[number];

/** Algorithm names a reported key type can end in: the creatable types plus stored-DER records. */
export const KEY_ALGORITHMS: readonly string[] = Object.freeze([...KEY_TYPES, 'GENERIC_DER', 'DER_PKEY']);

/** A reported key type, split into flags and algorithm. */
export interface KeyTypeInfo {
  /** The string exactly as the device sent it. */
  readonly raw: string;
  /** Recognised attribute flags, in the order sent. */
  readonly flags: readonly KeyFlag[];
  /** The algorithm: the last token that is not a flag; `undefined` if there is none. */
  readonly algorithm: string | undefined;
  /** Tokens that are neither a known flag nor a known algorithm name. */
  readonly unknown: readonly string[];
}

const flagSet: ReadonlySet<string> = new Set(KEY_FLAGS);
const algorithmSet: ReadonlySet<string> = new Set(KEY_ALGORITHMS);

/**
 * Parse a key type. List and search report comma-joined tokens such as
 * `PKEY,ECDH,ExDSA,SECP256R1`; key get reports a bare algorithm name for
 * asymmetric keys. Unknown tokens never raise an error: they are kept in
 * `unknown`, and `raw` keeps the original string.
 */
// implements: REQ-KEY-005
export function parseKeyType(raw: string): KeyTypeInfo {
  const tokens = raw.split(',').map((token) => token.trim()).filter((token) => token !== '');
  const flags = tokens.filter((token): token is KeyFlag => flagSet.has(token));
  const others = tokens.filter((token) => !flagSet.has(token));
  return {
    raw,
    flags,
    algorithm: others.at(-1),
    unknown: others.filter((token) => !algorithmSet.has(token)),
  };
}
