---
id: STEP-M1A-080
title: Crypto shim and eJWT builder with the login vector
milestone: M1A
implements: ["REQ-AUTH-002", "REQ-AUTH-003"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-040"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `src/crypto/` wraps Web Crypto for PBKDF2-HMAC-SHA256, X25519
(private key from a 32-byte seed, public-key derivation, shared secret) and
HMAC-SHA256; `src/auth/ejwt.ts` builds the login proof and reproduces the
REQ-AUTH-002 vector byte for byte in Node 24 and in the browser.

**Notes:** Only `globalThis.crypto.subtle`. X25519 import goes through
PKCS#8 or JWK (ARCHITECTURE.md §11, risk 1); the public key must be
derivable from the imported private key identically in both runtimes. The
derived key is kept non-extractable where the runtime allows (used by
STEP-M1A-090). Claims are serialised compactly in the order `jti`, `aud`,
`exp`, `iat`, `iss`, `scope`, with `/` unescaped. The vector test runs the
full 600 000 iterations. The API offers no way to choose another KDF (D6).

**Definition of done**
- [ ] The PBKDF2 wrapper reproduces a published PBKDF2-HMAC-SHA256 test vector
- [ ] The X25519 wrapper reproduces the RFC 7748 test vectors in Node 24 and in the browser run
- [ ] The passphrase is used as its UTF-8 bytes without normalisation; the salt is the UTF-8 bytes of the `eid` text, not its decoded bytes
- [ ] For the REQ-AUTH-002 vector the derived public key equals the stated `iss`
- [ ] The eJWT builder yields the three vector segments exactly, in Node 24 and in the browser run
- [ ] Claims are serialised without whitespace, in the stated order, with `/` not escaped
- [ ] The public API offers no way to select another derivation
