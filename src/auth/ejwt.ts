/**
 * Login key derivation and the login proof (eJWT) of the passphrase flow.
 *
 * ARCHITECTURE.md §5.1, from https://github.com/KajtomatO/encedo-hem-c-api:
 * PBKDF2-HMAC-SHA256 (600 000 iterations, 32 bytes, salt = the challenge
 * `eid` text) gives the X25519 private key; X25519 with the challenge `spk`
 * gives the HMAC key that signs the proof.
 *
 * @packageDocumentation
 */
import { base64ToBytes, bytesToBase64, bytesToBase64Url } from '../codec/base64.js';
import { utf8Encode } from '../codec/utf8.js';
import { HemProtocolError } from '../errors.js';
import { hmacSha256, importX25519PrivateKey, pbkdf2Sha256, x25519, x25519PublicKey } from '../crypto/webcrypto.js';

/** PBKDF2 iteration count of the login derivation. */
export const PBKDF2_ITERATIONS = 600_000;
/** Length of the derived X25519 private key, in bytes. */
export const DERIVED_KEY_BYTES = 32;

/** The fixed eJWT header. */
export const EJWT_HEADER = '{"ecdh":"x25519","alg":"HS256","typ":"JWT"}';
const EJWT_HEADER_SEGMENT = bytesToBase64Url(utf8Encode(EJWT_HEADER));

/** A derived login key, bound to the challenge `eid` it was derived for. */
export interface LoginKey {
  /** Non-extractable X25519 private key. */
  readonly privateKey: CryptoKey;
  /** Matching public key, 32 bytes. */
  readonly publicKey: Uint8Array;
  /** The challenge `eid` used as the salt. */
  readonly eid: string;
}

/** Claims of a login proof, apart from `iss`, which comes from the key. */
export interface ProofClaims {
  /** The challenge `jti`. */
  readonly jti: string;
  /** The challenge `spk` text, verbatim; becomes `aud` and is the X25519 peer key. */
  readonly spk: string;
  /** Requested token expiry, Unix seconds. */
  readonly exp: number;
  /** Issue time, Unix seconds. */
  readonly iat: number;
  /** Requested token scope. */
  readonly scope: string;
}

/**
 * Derive the login key from the passphrase: PBKDF2-HMAC-SHA256 over the
 * passphrase's UTF-8 bytes (not normalised), salted with the UTF-8 bytes of
 * the `eid` text exactly as received (not its base64-decoded bytes).
 */
// implements: REQ-AUTH-003
export async function deriveLoginKey(passphrase: string, eid: string): Promise<LoginKey> {
  const seed = await pbkdf2Sha256(utf8Encode(passphrase), utf8Encode(eid), PBKDF2_ITERATIONS, DERIVED_KEY_BYTES);
  try {
    const privateKey = await importX25519PrivateKey(seed, false);
    const publicKey = await x25519PublicKey(privateKey);
    return { privateKey, publicKey, eid };
  } finally {
    seed.fill(0);
  }
}

function requireInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) throw new RangeError(`eJWT claim ${name} must be an integer`);
}

/**
 * Build the login proof: `<header>.<claims>.<tag>`, each base64url without
 * padding. Claims are compact JSON in the order jti, aud, exp, iat, iss,
 * scope; the tag is HMAC-SHA256 keyed with X25519(private key, spk).
 */
// implements: REQ-AUTH-002
export async function buildLoginProof(key: LoginKey, claims: ProofClaims): Promise<string> {
  requireInteger(claims.exp, 'exp');
  requireInteger(claims.iat, 'iat');
  let peer: Uint8Array;
  try {
    peer = base64ToBytes(claims.spk, 'challenge spk');
  } catch (error) {
    throw new HemProtocolError('Login challenge has an invalid spk', { cause: error });
  }
  if (peer.length !== 32) throw new HemProtocolError('Login challenge spk is not a 32-byte X25519 key');

  // JSON.stringify keeps insertion order, adds no whitespace and does not escape '/'.
  const payload = JSON.stringify({
    jti: claims.jti,
    aud: claims.spk,
    exp: claims.exp,
    iat: claims.iat,
    iss: bytesToBase64(key.publicKey),
    scope: claims.scope,
  });
  const signingInput = `${EJWT_HEADER_SEGMENT}.${bytesToBase64Url(utf8Encode(payload))}`;
  const secret = await x25519(key.privateKey, peer);
  try {
    const tag = await hmacSha256(secret, utf8Encode(signingInput));
    return `${signingInput}.${bytesToBase64Url(tag)}`;
  } finally {
    secret.fill(0);
  }
}
