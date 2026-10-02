import { describe, expect, it } from "vitest";
import { decodeHex, encodeHex, utf8Encode, decodeBase64 } from "../../../src/codec/index.js";
import { hmacSha256, importX25519PrivateKey, pbkdf2Sha256, x25519, x25519PublicKey } from "../../../src/crypto/shim.js";
import { buildProof, deriveLoginKey, serialiseClaims } from "../../../src/auth/ejwt.js";
import * as pkg from "../../../src/index.js";
import { LOGIN_VECTOR as V, LOGIN_VECTOR_PROOF, PBKDF2_SHA256_VECTOR as P, X25519_VECTORS as X } from "../../support/vectors.js";

describe("crypto shim", () => {
  // verifies: REQ-AUTH-003
  it("PBKDF2-HMAC-SHA256 reproduces the RFC 7914 vector", async () => {
    const dk = await pbkdf2Sha256(utf8Encode(P.password), utf8Encode(P.salt), P.iterations, 64);
    expect(encodeHex(dk)).toBe(P.dk);
  });

  // verifies: REQ-AUTH-003
  it("X25519 reproduces the RFC 7748 vectors", async () => {
    const k = await importX25519PrivateKey(decodeHex(X.scalarMult.scalar));
    expect(encodeHex(await x25519(k, decodeHex(X.scalarMult.u)))).toBe(X.scalarMult.out);
    const alice = await importX25519PrivateKey(decodeHex(X.dh.alicePriv));
    const bob = await importX25519PrivateKey(decodeHex(X.dh.bobPriv));
    expect(encodeHex(await x25519PublicKey(alice))).toBe(X.dh.alicePub);
    expect(encodeHex(await x25519PublicKey(bob))).toBe(X.dh.bobPub);
    expect(encodeHex(await x25519(alice, decodeHex(X.dh.bobPub)))).toBe(X.dh.shared);
    expect(encodeHex(await x25519(bob, decodeHex(X.dh.alicePub)))).toBe(X.dh.shared);
  });

  it("HMAC-SHA256 reproduces RFC 4231 test case 2", async () => {
    const mac = await hmacSha256(utf8Encode("Jefe"), utf8Encode("what do ya want for nothing?"));
    expect(encodeHex(mac)).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
  });

  // verifies: REQ-AUTH-011
  it("imports the private key as a non-extractable CryptoKey", async () => {
    const k = await importX25519PrivateKey(decodeHex(X.dh.alicePriv));
    expect(k.extractable).toBe(false);
    expect(k.type).toBe("private");
  });
});

describe("login key and eJWT", () => {
  // verifies: REQ-AUTH-002, REQ-AUTH-003
  it("reproduces the REQ-AUTH-002 vector byte for byte, 600 000 iterations included", async () => {
    const key = await deriveLoginKey(V.passphrase, V.eid);
    expect(key.iss).toBe(V.iss);
    expect(key.eid).toBe(V.eid);
    const secret = await x25519(key.privateKey, decodeBase64(V.spk));
    const proof = await buildProof({ jti: V.jti, aud: V.spk, exp: V.exp, iat: V.iat, iss: key.iss, scope: V.scope }, secret);
    const [h, c, t] = proof.split(".");
    expect(h).toBe(V.header);
    expect(c).toBe(V.claims);
    expect(t).toBe(V.tag);
    expect(proof).toBe(LOGIN_VECTOR_PROOF);
  });

  // verifies: REQ-AUTH-003
  it("uses the eid text as salt, not its decoded bytes, and the passphrase unnormalised", async () => {
    const other = await deriveLoginKey(V.passphrase, V.eid.toUpperCase());
    expect(other.iss).not.toBe(V.iss);
    // NFC vs NFD forms of "é" are different passphrases
    const nfc = await deriveLoginKey("café", V.eid);
    const nfd = await deriveLoginKey("café", V.eid);
    expect(nfc.iss).not.toBe(nfd.iss);
  });

  // verifies: REQ-AUTH-002
  it("serialises claims compactly, in order, with / unescaped", () => {
    const json = serialiseClaims({ jti: "j", aud: "a/b+c=", exp: 2, iat: 1, iss: "i/s", scope: "keymgmt:use:00" });
    expect(json).toBe('{"jti":"j","aud":"a/b+c=","exp":2,"iat":1,"iss":"i/s","scope":"keymgmt:use:00"}');
    expect(json).not.toMatch(/\s|\\\//);
  });

  // verifies: REQ-AUTH-003
  it("offers no way to select another derivation", () => {
    const names = Object.keys(pkg).join(" ");
    expect(names).not.toMatch(/argon|kdf|derive/i);
  });
});
