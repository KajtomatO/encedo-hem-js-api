/**
 * Thin wrappers over Web Crypto (`globalThis.crypto.subtle`): PBKDF2,
 * X25519 and HMAC-SHA256. No primitive is implemented here.
 *
 * @packageDocumentation
 */
import { HemUnsupportedError } from '../errors.js';

type Bytes = Uint8Array<ArrayBuffer>;

/** Copy into a fresh ArrayBuffer-backed array, as Web Crypto's typings require. */
function bytes(data: Uint8Array): Bytes {
  return new Uint8Array(data);
}

function subtle(): SubtleCrypto {
  const api = globalThis.crypto?.subtle;
  if (!api) throw new HemUnsupportedError('This runtime does not provide Web Crypto (crypto.subtle)');
  return api;
}

/** Turn a missing algorithm into HemUnsupportedError; rethrow anything else. */
function unsupported(algorithm: string): (error: unknown) => never {
  return (error: unknown) => {
    if (error instanceof DOMException && error.name === 'NotSupportedError') {
      throw new HemUnsupportedError(`This runtime's Web Crypto does not support ${algorithm}`, { cause: error });
    }
    throw error;
  };
}

/** PBKDF2-HMAC-SHA256. */
// implements: REQ-AUTH-003
export async function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number, lengthBytes: number): Promise<Uint8Array> {
  const key = await subtle().importKey('raw', bytes(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, lengthBytes * 8);
  return new Uint8Array(bits);
}

/** HMAC-SHA256 of `data` under the raw `key`. */
export async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const hmacKey = await subtle().importKey('raw', bytes(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await subtle().sign('HMAC', hmacKey, bytes(data)));
}

// DER prefix of a PKCS#8 PrivateKeyInfo for X25519 (OID 1.3.101.110) holding a 32-byte key.
const X25519_PKCS8_PREFIX = Uint8Array.from([0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x6e, 0x04, 0x22, 0x04, 0x20]);
// u = 9, the X25519 base point (RFC 7748 §4.1).
const X25519_BASE_POINT = Uint8Array.from({ length: 32 }, (_, i) => (i === 0 ? 9 : 0));

/**
 * Import a 32-byte X25519 private key. Web Crypto accepts X25519 private keys
 * only as PKCS#8 or JWK, so the raw scalar is wrapped in a PKCS#8 header.
 * The temporary buffer is zeroed after import.
 */
export async function importX25519PrivateKey(scalar: Uint8Array, extractable = false): Promise<CryptoKey> {
  if (scalar.length !== 32) throw new RangeError('An X25519 private key is 32 bytes');
  const pkcs8 = new Uint8Array(X25519_PKCS8_PREFIX.length + 32);
  pkcs8.set(X25519_PKCS8_PREFIX);
  pkcs8.set(scalar, X25519_PKCS8_PREFIX.length);
  try {
    return await subtle().importKey('pkcs8', pkcs8, { name: 'X25519' }, extractable, ['deriveBits']).catch(unsupported('X25519'));
  } finally {
    pkcs8.fill(0);
  }
}

/** X25519(privateKey, u): the 32-byte shared secret with the raw public key `u`. */
export async function x25519(privateKey: CryptoKey, publicKey: Uint8Array): Promise<Uint8Array> {
  if (publicKey.length !== 32) throw new RangeError('An X25519 public key is 32 bytes');
  const peer = await subtle().importKey('raw', bytes(publicKey), { name: 'X25519' }, true, []).catch(unsupported('X25519'));
  return new Uint8Array(await subtle().deriveBits({ name: 'X25519', public: peer }, privateKey, 256));
}

/**
 * The public key of an X25519 private key, computed as X25519 with the base
 * point, since Web Crypto offers no direct way to obtain it from a
 * non-extractable private key.
 */
export function x25519PublicKey(privateKey: CryptoKey): Promise<Uint8Array> {
  return x25519(privateKey, X25519_BASE_POINT);
}
