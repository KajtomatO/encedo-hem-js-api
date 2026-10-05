---
id: STEP-M1A-060
title: Crypto shim and login proof (eJWT vector)
milestone: M1A
implements: ["REQ-AUTH-002", "REQ-AUTH-003", "REQ-TEST-002"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-050"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Thin wrappers over Web Crypto for PBKDF2, X25519 and HMAC-SHA256
reproduce published vectors, and the eJWT builder reproduces the vector of
REQ-AUTH-002 byte for byte — in Node 24 and in the browser run.

**Notes:**
- `src/crypto/` holds wrappers only; no primitive is implemented here
  (ARCHITECTURE.md §3). The eJWT builder goes in `src/auth/`.
- Key derivation per REQ-AUTH-003: PBKDF2-HMAC-SHA256, 600 000 iterations,
  32-byte output; password = the passphrase as UTF-8, not normalised; salt =
  the UTF-8 bytes of the `eid` text as received, not its decoded bytes.
- eJWT per REQ-AUTH-002: fixed header; claims serialised without whitespace
  in the order `jti`, `aud`, `exp`, `iat`, `iss`, `scope`, with `/` not
  escaped; HMAC-SHA256 tag keyed with the raw shared secret.
- ARCHITECTURE.md §11 risk 1: Web Crypto imports an X25519 private key only
  as PKCS#8 or JWK and has no direct way to get the public key from it. A
  scratch probe on 2026-10-05 (Node v24.21.0, Web Crypto only) reproduced
  the whole REQ-AUTH-002 vector this way: the PBKDF2 output wrapped in a
  PKCS#8 header and imported as a non-extractable key; the public key
  obtained by X25519 against the base point. Whether a browser behaves the
  same is what this step settles. Record the finding in the evidence.
- A runtime without X25519 in Web Crypto is reported as
  `HemUnsupportedError` (ARCHITECTURE.md §4).
- Each published vector cites its source in the test (RFC 7748 for X25519).
- Partly closed here: REQ-TEST-002 (the browser run includes the
  cryptographic tests). Closed elsewhere: REQ-AUTH-003 "no way to select
  another derivation" in STEP-M1A-120.

**Definition of done**
- [ ] The PBKDF2 wrapper reproduces a published PBKDF2-HMAC-SHA256 test
      vector.
- [ ] The X25519 wrapper reproduces the RFC 7748 test vectors.
- [ ] The HMAC-SHA256 wrapper reproduces a published test vector.
- [ ] The REQ-AUTH-002 vector inputs, fed through the real derivation with
      600 000 iterations, give the stated `iss` and the three segments
      exactly.
- [ ] Tests show the passphrase is used as UTF-8 without normalisation and
      the salt is the `eid` text, not its base64-decoded bytes.
- [ ] Tests show the claims are serialised without whitespace, in the stated
      order, with `/` not escaped.
- [ ] All of the above pass in Node 24 and in the browser run; the risk 1
      finding for the browser is written into this step's evidence.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
