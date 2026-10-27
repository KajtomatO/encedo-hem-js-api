---
id: STEP-M2A-040
title: ECDH and ECDH-agreed key modes for HMAC, cipher, wrap
milestone: M2A
implements: ["REQ-OPS-010", "REQ-OPS-015"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2A-020", "STEP-M2A-030"]
evidence:
  commits: ["89b5c28"]
  tests: ["verifies: REQ-OPS-010 (tests/unit/crypto-ecdh.test.ts)", "verifies: REQ-OPS-015 (tests/unit/crypto-ecdh.test.ts)"]
  notes: "npm run check on 2026-10-27: 92 files, 1831 tests passed in Node v24.21.0 and headless Chromium. The peer and ctx fields are declared on each params interface rather than through `extends AgreedKeyParams`: the surface test compares interface headers textually and reported the extends clause on HmacParams and WrapParams (0.1.0 entries) as a change; the exported AgreedKeyParams interface documents the mode. Surface snapshot: 23 additions, no change. HMAC in agreed mode requires alg (raw ECDH secret as key); with a stored key alg is refused rather than silently dropped. ctx is refused without a peer and on HMAC. ECDH response field: ecdh. Device-side facts (raw secret truncated to 32 bytes, HKDF info strings) are from the reference and the C SDK; the (M2B) boxes check them live."
reopened: []
cancelled: null
---

**Goal:** `client.crypto.ecdh` returns the shared secret with a peer; HMAC hash and verify, encrypt, decrypt, wrap and unwrap each accept a peer so the device derives the working key itself.

**Notes:**
- ECDH (`POST /api/crypto/ecdh`): body `{kid}` plus exactly one of
  `ext_kid`/`pubkey`, and `alg` when given; the TSDoc states that the raw
  secret is truncated to 32 bytes (quirk 9) and that a hash `alg` gives the
  digest instead.
- Agreed-key mode (REQ-OPS-015): one shared `peer` parameter shape
  (`{ extKid } | { pubkey }`) reused by the six symmetric operations, sent
  as `ext_kid` or `pubkey`; both forms raise `HemValidationError`. HMAC in
  this mode requires `alg` (the raw ECDH secret is the key); cipher and
  wrap take an optional context of up to 64 bytes (HKDF info `encedo-aes`
  / `encedo-kek`) [YAML], [C-SDK]. The scope stays `keymgmt:use:<kid>` of
  the primary key.
- The change to the existing HMAC, wrap and unwrap parameters is additive
  (optional fields): REQ-API-008 holds; the surface snapshot gains entries
  only.

**Definition of done**
- [x] ECDH: body `{kid}` plus one peer and `alg` when given; scope
      `keymgmt:use:<kid>`; both peers or neither raises
      `HemValidationError`; result is the secret as bytes; truncation is
      documented.
- [x] HMAC hash and verify, encrypt, decrypt, wrap and unwrap accept a peer
      and send it as `ext_kid` or `pubkey`; both forms raise; HMAC without
      `alg` in this mode raises; a context over 64 bytes raises.
- [x] The token scope in agreed-key mode is `keymgmt:use:<kid>` of the
      primary key (conformance test).
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
