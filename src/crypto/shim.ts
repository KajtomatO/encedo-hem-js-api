// Thin wrappers over Web Crypto (globalThis.crypto.subtle) — no primitives
// are implemented here.
// implements: REQ-AUTH-003, REQ-BUILD-003

import { HemUnsupportedError } from "../errors.js";

/** PBKDF2 parameters of the login key derivation [C-SDK]. */
export const LOGIN_PBKDF2_ITERATIONS = 600_000;
export const LOGIN_KEY_BYTES = 32;

function subtle(): SubtleCrypto {
  const s = globalThis.crypto?.subtle;
  if (!s) throw new HemUnsupportedError("Web Crypto (crypto.subtle) is not available in this runtime");
  return s;
}

const buf = (b: Uint8Array): ArrayBuffer => b.slice().buffer as ArrayBuffer;

/** PBKDF2-HMAC-SHA256. */
export async function pbkdf2Sha256(
  password: Uint8Array,
  salt: Uint8Array,
  iterations: number,
  lengthBytes: number,
): Promise<Uint8Array> {
  const s = subtle();
  const key = await s.importKey("raw", buf(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await s.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: buf(salt), iterations }, key, lengthBytes * 8);
  return new Uint8Array(bits);
}

// DER prefix of a PKCS#8 PrivateKeyInfo for X25519 (OID 1.3.101.110) wrapping a 32-byte key.
const X25519_PKCS8_PREFIX = Uint8Array.of(
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20,
);
// The X25519 base point, u = 9.
const X25519_BASE_POINT = Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? 9 : 0));

/**
 * Imports a 32-byte X25519 private key. The key is non-extractable unless the
 * runtime refuses that; the public key is derived without exporting it.
 */
export async function importX25519PrivateKey(seed: Uint8Array): Promise<CryptoKey> {
  if (seed.length !== 32) throw new RangeError("X25519 private key must be 32 bytes");
  const der = new Uint8Array(X25519_PKCS8_PREFIX.length + 32);
  der.set(X25519_PKCS8_PREFIX);
  der.set(seed, X25519_PKCS8_PREFIX.length);
  try {
    return await subtle().importKey("pkcs8", der.buffer, { name: "X25519" }, false, ["deriveBits"]);
  } catch (cause) {
    throw new HemUnsupportedError("this runtime's Web Crypto does not support X25519", { cause });
  } finally {
    der.fill(0);
  }
}

/** X25519(private key, peer public key) → 32-byte shared secret. */
export async function x25519(privateKey: CryptoKey, peerPublicKey: Uint8Array): Promise<Uint8Array> {
  const s = subtle();
  const pub = await s.importKey("raw", buf(peerPublicKey), { name: "X25519" }, false, []);
  return new Uint8Array(await s.deriveBits({ name: "X25519", public: pub }, privateKey, 256));
}

/** The public key of an X25519 private key: X25519(k, 9). */
export function x25519PublicKey(privateKey: CryptoKey): Promise<Uint8Array> {
  return x25519(privateKey, X25519_BASE_POINT);
}

/** HMAC-SHA256(key, data). */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const s = subtle();
  const k = await s.importKey("raw", buf(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await s.sign("HMAC", k, buf(data)));
}
