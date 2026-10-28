---
id: STEP-M2A-030
title: AES encrypt and decrypt
milestone: M2A
implements: ["REQ-OPS-008", "REQ-OPS-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: ["c0562cb"]
  tests: ["verifies: REQ-OPS-008 (tests/unit/crypto-cipher.test.ts)", "verifies: REQ-OPS-009 (tests/unit/crypto-cipher.test.ts)"]
  notes: "npm run check on 2026-10-27: 90 files, 1741 tests passed in Node v24.21.0 and headless Chromium. Response fields from the reference: ciphertext, iv, tag; plaintext. The IV is read as required for CBC/GCM and the tag for GCM (HemProtocolError when absent); ECB tolerates either being present. Decrypt refuses an IV with ECB, a tag outside GCM and aad outside GCM (library decision, noted in REQ-OPS-009). The ciphertext of decrypt has no upper bound of its own (the reference states none); the 'max 16 bytes nominal' of aad is not enforced. Surface snapshot: 22 additions. The peer/ctx fields of the ECDH-agreed mode come with STEP-M2A-040."
reopened: []
cancelled: null
---

**Goal:** `client.crypto` offers AES encryption and decryption in ECB, CBC and GCM mode with a stored key; the encrypt result carries everything decrypt needs.

**Notes:**
- `src/api/crypto.ts`; `POST /api/crypto/cipher/encrypt` and
  `/decrypt`; scope `keymgmt:use:<kid>`; TLS-only.
- Algorithms: `AES128|AES192|AES256` × `-ECB|-CBC|-GCM`. The device
  generates the 16-byte IV and returns it; GCM also returns a 16-byte tag
  [YAML]. ECB input must be a multiple of 16 bytes; `aad` only with GCM.
- Encrypt result: `{ ciphertext, iv?, tag? }` as bytes (field names from
  the reference). Decrypt takes `iv`, `tag`, `aad` as the mode requires; an
  IV or tag that is not exactly 16 bytes, or missing where required, raises
  `HemValidationError`; 406 raises `HemOperationFailedError`.
- Message limits from the reference, enforced before sending (REQ-API-005).

**Definition of done**
- [x] Encrypt: body `{kid, msg, alg}` plus `aad` for GCM; scope
      `keymgmt:use:<kid>`; result has ciphertext, IV (CBC, GCM) and tag
      (GCM) as bytes.
- [x] Encrypt: unknown algorithm, ECB input not a multiple of 16 bytes, or
      `aad` with a non-GCM mode raises `HemValidationError`.
- [x] Decrypt: body `{kid, msg, alg}` plus `iv`, `tag`, `aad` as the mode
      requires; result is the plaintext as bytes; wrong-length or missing
      IV/tag raises `HemValidationError`; 406 raises
      `HemOperationFailedError`.
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
