// Login proof (eJWT) and the derivation of the login key.
// implements: REQ-AUTH-002, REQ-AUTH-003

import { encodeBase64, encodeBase64Url } from "../codec/base64.js";
import { utf8Encode } from "../codec/utf8.js";
import {
  LOGIN_KEY_BYTES,
  LOGIN_PBKDF2_ITERATIONS,
  hmacSha256,
  importX25519PrivateKey,
  pbkdf2Sha256,
  x25519PublicKey,
} from "../crypto/shim.js";

/** The fixed eJWT header; only `ecdh` is read by the firmware [C-SDK]. */
export const EJWT_HEADER = '{"ecdh":"x25519","alg":"HS256","typ":"JWT"}';

/** The login key: X25519 private key derived from the passphrase, bound to the device `eid`. */
export interface LoginKey {
  readonly eid: string;
  readonly privateKey: CryptoKey;
  /** Standard base64 (with padding) of the public key — the proof's `iss`. */
  readonly iss: string;
}

/**
 * Derives the login key: PBKDF2-HMAC-SHA256(passphrase as UTF-8, salt = the
 * `eid` text as UTF-8, 600 000 iterations, 32 bytes) is the X25519 private
 * key. No other derivation exists (ARCHITECTURE.md D6).
 */
export async function deriveLoginKey(passphrase: string, eid: string): Promise<LoginKey> {
  const seed = await pbkdf2Sha256(utf8Encode(passphrase), utf8Encode(eid), LOGIN_PBKDF2_ITERATIONS, LOGIN_KEY_BYTES);
  try {
    const privateKey = await importX25519PrivateKey(seed);
    const iss = encodeBase64(await x25519PublicKey(privateKey));
    return { eid, privateKey, iss };
  } finally {
    seed.fill(0);
  }
}

export interface ProofClaims {
  jti: string;
  /** The challenge `spk` string, verbatim. */
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  scope: string;
}

/** Compact claims JSON in the fixed order jti, aud, exp, iat, iss, scope; `/` is not escaped. */
export function serialiseClaims(c: ProofClaims): string {
  return `{"jti":${JSON.stringify(c.jti)},"aud":${JSON.stringify(c.aud)},"exp":${c.exp},"iat":${c.iat},"iss":${JSON.stringify(c.iss)},"scope":${JSON.stringify(c.scope)}}`;
}

/** Builds the eJWT: base64url(header).base64url(claims).base64url(HMAC-SHA256(secret, first two)). */
export async function buildProof(claims: ProofClaims, sharedSecret: Uint8Array): Promise<string> {
  const signingInput = `${encodeBase64Url(utf8Encode(EJWT_HEADER))}.${encodeBase64Url(utf8Encode(serialiseClaims(claims)))}`;
  const tag = await hmacSha256(sharedSecret, utf8Encode(signingInput));
  return `${signingInput}.${encodeBase64Url(tag)}`;
}
