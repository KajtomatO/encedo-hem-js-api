import { describe, expect, it } from 'vitest';
import { bytesToHex, hexToBytes } from '../../src/codec/base64.js';
import { utf8Encode } from '../../src/codec/utf8.js';
import { hmacSha256, importX25519PrivateKey, pbkdf2Sha256, x25519, x25519PublicKey } from '../../src/crypto/webcrypto.js';

describe('PBKDF2-HMAC-SHA256', () => {
  // RFC 7914 §11 (PBKDF2-HMAC-SHA256 test vectors).
  // verifies: REQ-AUTH-003, REQ-TEST-002
  it('reproduces the RFC 7914 vectors', async () => {
    expect(bytesToHex(await pbkdf2Sha256(utf8Encode('passwd'), utf8Encode('salt'), 1, 64))).toBe(
      '55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783',
    );
    expect(bytesToHex(await pbkdf2Sha256(utf8Encode('Password'), utf8Encode('NaCl'), 80000, 64))).toBe(
      '4ddcd8f60b98be21830cee5ef22701f9641a4418d04c0414aeff08876b34ab56a1d425a1225833549adb841b51c9b3176a272bdebba1d078478f62b397f33c8d',
    );
  });
});

describe('HMAC-SHA256', () => {
  // RFC 4231 §4.2 and §4.3 (test cases 1 and 2).
  // verifies: REQ-AUTH-002, REQ-TEST-002
  it('reproduces the RFC 4231 vectors', async () => {
    expect(bytesToHex(await hmacSha256(new Uint8Array(20).fill(0x0b), utf8Encode('Hi There')))).toBe(
      'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7',
    );
    expect(bytesToHex(await hmacSha256(utf8Encode('Jefe'), utf8Encode('what do ya want for nothing?')))).toBe(
      '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843',
    );
  });
});

describe('X25519', () => {
  // RFC 7748 §5.2, first test vector (scalar multiplication).
  // verifies: REQ-AUTH-003
  it('reproduces the RFC 7748 §5.2 scalar-multiplication vector', async () => {
    const key = await importX25519PrivateKey(hexToBytes('a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4'));
    const out = await x25519(key, hexToBytes('e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c'));
    expect(bytesToHex(out)).toBe('c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552');
  });

  // RFC 7748 §6.1 (Diffie-Hellman with Alice's and Bob's keys).
  // verifies: REQ-AUTH-003, REQ-TEST-002
  it('reproduces the RFC 7748 §6.1 key pairs and shared secret', async () => {
    const alice = await importX25519PrivateKey(hexToBytes('77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a'));
    const bob = await importX25519PrivateKey(hexToBytes('5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb'));
    const alicePublic = await x25519PublicKey(alice);
    const bobPublic = await x25519PublicKey(bob);
    expect(bytesToHex(alicePublic)).toBe('8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a');
    expect(bytesToHex(bobPublic)).toBe('de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f');
    const shared = '4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742';
    expect(bytesToHex(await x25519(alice, bobPublic))).toBe(shared);
    expect(bytesToHex(await x25519(bob, alicePublic))).toBe(shared);
  });

  // ARCHITECTURE.md §11 risk 1: the derived key stays inside Web Crypto.
  // verifies: REQ-AUTH-003
  it('imports the private key as non-extractable by default', async () => {
    const key = await importX25519PrivateKey(new Uint8Array(32).fill(7));
    expect(key.extractable).toBe(false);
    expect(key.type).toBe('private');
    expect(key.algorithm.name).toBe('X25519');
    await expect(globalThis.crypto.subtle.exportKey('pkcs8', key)).rejects.toThrow();
  });

  it('rejects keys of the wrong length', async () => {
    await expect(importX25519PrivateKey(new Uint8Array(31))).rejects.toThrow(RangeError);
    const key = await importX25519PrivateKey(new Uint8Array(32).fill(7));
    await expect(x25519(key, new Uint8Array(33))).rejects.toThrow(RangeError);
  });
});
