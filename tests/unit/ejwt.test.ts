import { describe, expect, it } from 'vitest';
import { EJWT_HEADER, PBKDF2_ITERATIONS, buildLoginProof, deriveLoginKey } from '../../src/auth/ejwt.js';
import { base64ToBytes, bytesToBase64, bytesToHex } from '../../src/codec/base64.js';
import { utf8Decode, utf8Encode } from '../../src/codec/utf8.js';
import { importX25519PrivateKey, pbkdf2Sha256, x25519PublicKey } from '../../src/crypto/webcrypto.js';
import { HemProtocolError } from '../../src/errors.js';
import { loginVector as v } from '../support/vectors.js';

const segment = (text: string): string => utf8Decode(base64ToBytes(text));

describe('login key derivation', () => {
  // verifies: REQ-AUTH-003
  it('derives the vector public key (iss) with 600 000 PBKDF2 iterations', async () => {
    expect(PBKDF2_ITERATIONS).toBe(600_000);
    const key = await deriveLoginKey(v.passphrase, v.eid);
    expect(bytesToBase64(key.publicKey)).toBe(v.iss);
    expect(key.eid).toBe(v.eid);
    expect(key.privateKey.extractable).toBe(false);
  }, 60_000);

  // verifies: REQ-AUTH-003
  it('uses the eid text as the salt, not its decoded bytes, and the 32-byte output as the X25519 key', async () => {
    const asText = await pbkdf2Sha256(utf8Encode(v.passphrase), utf8Encode(v.eid), PBKDF2_ITERATIONS, 32);
    const publicFromText = await x25519PublicKey(await importX25519PrivateKey(asText));
    expect(bytesToBase64(publicFromText)).toBe(v.iss);

    // The eid also parses as base64; the decoded bytes must not be the salt.
    const decodedSalt = base64ToBytes(v.eid);
    const asDecoded = await pbkdf2Sha256(utf8Encode(v.passphrase), decodedSalt, PBKDF2_ITERATIONS, 32);
    expect(bytesToHex(asDecoded)).not.toBe(bytesToHex(asText));
  }, 60_000);

  // verifies: REQ-AUTH-003
  it('uses the passphrase as UTF-8 without Unicode normalisation', async () => {
    const composed = 'zażółć'; // ó as one code point (NFC)
    const decomposed = 'zażółć'; // o + combining acute (NFD)
    expect(composed.normalize('NFC')).toBe(decomposed.normalize('NFC'));
    const [a, b] = await Promise.all([deriveLoginKey(composed, v.eid), deriveLoginKey(decomposed, v.eid)]);
    expect(bytesToHex(a.publicKey)).not.toBe(bytesToHex(b.publicKey));

    const expected = await pbkdf2Sha256(utf8Encode(decomposed), utf8Encode(v.eid), PBKDF2_ITERATIONS, 32);
    expect(bytesToHex(b.publicKey)).toBe(bytesToHex(await x25519PublicKey(await importX25519PrivateKey(expected))));
  }, 120_000);
});

describe('login proof (eJWT)', () => {
  // Runs in the Node and the browser project (REQ-TEST-002).
  // verifies: REQ-AUTH-002, REQ-TEST-002
  it('reproduces the REQ-AUTH-002 vector byte for byte through the real derivation', async () => {
    const key = await deriveLoginKey(v.passphrase, v.eid);
    const proof = await buildLoginProof(key, { jti: v.jti, spk: v.spk, exp: v.exp, iat: v.iat, scope: v.scope });
    expect(proof).toBe(`${v.header}.${v.claims}.${v.tag}`);
    expect(proof.split('.')).toEqual([v.header, v.claims, v.tag]);
  }, 60_000);

  // verifies: REQ-AUTH-002
  it('uses the fixed header and compact claims in the order jti, aud, exp, iat, iss, scope, with / unescaped', async () => {
    const key = await deriveLoginKey(v.passphrase, v.eid);
    const proof = await buildLoginProof(key, { jti: v.jti, spk: v.spk, exp: v.exp, iat: v.iat, scope: 'keymgmt:use:0123456789abcdef0123456789abcdef' });
    const [header, claims, tag] = proof.split('.') as [string, string, string];

    expect(segment(header)).toBe(EJWT_HEADER);
    expect(segment(header)).toBe('{"ecdh":"x25519","alg":"HS256","typ":"JWT"}');
    const json = segment(claims);
    expect(json).toBe(
      `{"jti":"${v.jti}","aud":"${v.spk}","exp":${v.exp},"iat":${v.iat},"iss":"${v.iss}","scope":"keymgmt:use:0123456789abcdef0123456789abcdef"}`,
    );
    expect(json).not.toMatch(/\s/);
    expect(json).toContain('/hOee5rTtcl7ajJdYwVwcjL5cxY=');
    expect(json).not.toContain('\\/');
    expect(Object.keys(JSON.parse(json) as object)).toEqual(['jti', 'aud', 'exp', 'iat', 'iss', 'scope']);
    for (const part of [header, claims, tag]) expect(part).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(base64ToBytes(tag)).toHaveLength(32);
  }, 60_000);

  it('rejects a challenge spk that is not a 32-byte key, and non-integer times', async () => {
    const key = await deriveLoginKey(v.passphrase, v.eid);
    const claims = { jti: v.jti, spk: v.spk, exp: v.exp, iat: v.iat, scope: v.scope };
    await expect(buildLoginProof(key, { ...claims, spk: 'AQID' })).rejects.toThrow(HemProtocolError);
    await expect(buildLoginProof(key, { ...claims, spk: 'not base64!' })).rejects.toThrow(HemProtocolError);
    await expect(buildLoginProof(key, { ...claims, exp: 1.5 })).rejects.toThrow(RangeError);
  }, 60_000);
});
