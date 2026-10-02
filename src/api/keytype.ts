// Key type strings as flags plus an algorithm.
// implements: REQ-KEY-005

/** Attribute flags that prefix a key type string [YAML]. */
export const KEY_FLAGS = ["ATT", "PKEY", "ECDH", "ExDSA", "CERT", "PQC"] as const;
export type KeyFlag = (typeof KEY_FLAGS)[number];

/** Algorithm names of the reference [YAML]. */
export const KEY_ALGORITHMS = [
  "GENERIC_DER",
  "SECP256R1", "SECP384R1", "SECP521R1", "SECP256K1",
  "CURVE25519", "CURVE448", "ED25519", "ED448",
  "MLKEM512", "MLKEM768", "MLKEM1024", "MLDSA44", "MLDSA65", "MLDSA87",
  "SHA2-256", "SHA2-384", "SHA2-512", "SHA3-256", "SHA3-384", "SHA3-512",
  "AES128", "AES192", "AES256",
] as const;
export type KeyAlgorithm = (typeof KEY_ALGORITHMS)[number];

/** A parsed key type, e.g. `PKEY,ECDH,ExDSA,SECP256R1`. */
export interface KeyType {
  /** The string as the device sent it. */
  readonly raw: string;
  /** Recognised attribute flags, in the order sent. */
  readonly flags: readonly KeyFlag[];
  /** The algorithm, when one of the tokens names a known algorithm. */
  readonly algorithm: KeyAlgorithm | undefined;
  /** Tokens that are neither a known flag nor a known algorithm. */
  readonly unknown: readonly string[];
}

/**
 * Parses a key type: comma-joined flags followed by the algorithm, or a bare
 * algorithm name (as key get returns it). Unknown tokens are kept, not
 * rejected.
 */
export function parseKeyType(raw: string): KeyType {
  const flags: KeyFlag[] = [];
  const unknown: string[] = [];
  let algorithm: KeyAlgorithm | undefined;
  for (const token of raw.split(",").map((t) => t.trim()).filter((t) => t !== "")) {
    if ((KEY_FLAGS as readonly string[]).includes(token)) flags.push(token as KeyFlag);
    else if (algorithm === undefined && (KEY_ALGORITHMS as readonly string[]).includes(token)) algorithm = token as KeyAlgorithm;
    else unknown.push(token);
  }
  return { raw, flags, algorithm, unknown };
}
