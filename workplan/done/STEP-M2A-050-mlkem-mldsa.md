---
id: STEP-M2A-050
title: ML-KEM encaps and decaps, ML-DSA sign and verify
milestone: M2A
implements: ["REQ-OPS-011", "REQ-OPS-012", "REQ-OPS-013", "REQ-OPS-014"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2A-020"]
evidence:
  commits: ["700ef48"]
  tests: ["verifies: REQ-OPS-011 (tests/unit/crypto-pqc.test.ts)", "verifies: REQ-OPS-012 (tests/unit/crypto-pqc.test.ts)", "verifies: REQ-OPS-013 (tests/unit/crypto-pqc.test.ts)", "verifies: REQ-OPS-014 (tests/unit/crypto-pqc.test.ts)"]
  notes: "npm run check on 2026-10-27: 94 files, 1957 tests passed in Node v24.21.0 and headless Chromium. Names: crypto.mlkemEncaps / mlkemDecaps / mldsaSign / mldsaVerify. Finding: the WHATWG Response constructor accepts statuses 200–599 only, so a 795 status cannot be faked with `new Response`; FakeFetch now serves such a status as a Response-like object (tests/support/fake-fetch.ts), which is what src/transport/node-https.ts already does for the real device (its unit test passes 795 through). How a browser's fetch surfaces such a status stays the (M2B) probe. The ML-DSA invalid rule (src/api/crypto.ts isMldsaInvalid): HemError with a status that is not 401/403 and not 2xx/3xx → false; redirects, validation and transport failures raise. Decaps does not require the reply's alg (unreliable, quirk 2). Verify caps the signature at 4627 bytes; the 7300-byte body limit is now reachable through a real operation, so the conformance limits table covers parameter 'body'. Surface snapshot: 25 additions."
reopened: []
cancelled: null
---

**Goal:** `client.crypto` offers the four post-quantum operations; decapsulation hides the firmware's `alg` field, and ML-DSA verify treats any completed non-success, non-auth response as an invalid signature.

**Notes:**
- Paths `POST /api/crypto/pqc/mlkem/encaps`, `/mlkem/decaps`,
  `/mldsa/sign`, `/mldsa/verify`; scope `keymgmt:use:<kid>`; TLS-only.
- Encaps: body `{kid}`; result has the parameter-set name, the 32-byte
  secret and the ciphertext (768/1088/1568 bytes) as bytes; 406 raises
  `HemOperationFailedError`.
- Decaps: body `{kid, ct}`; a ciphertext of another length raises
  `HemValidationError`; the result is the secret only — the response's
  `alg` is an unrelated internal string (quirk 2) and is never exposed.
- ML-DSA sign: body `{kid, msg}` plus `ctx` (≤ 255 bytes); result has the
  parameter-set name and the signature as bytes.
- ML-DSA verify (quirk 3, §11 risk 2): a failed verification puts a raw
  code (100 per [YAML], 795 observed [C-SDK]) in the status line. The
  transport maps unknown statuses to `HemDeviceError`; the binding must
  catch the transport's status mapping below that: 200 → `true`; 401/403
  raise; any other completed status, standard or not, → `false`. Check in
  `src/transport/transport.ts` how a non-standard status reaches the
  binding and extend the fake fetch to produce one. A request whose JSON
  body would exceed 7300 bytes raises `HemValidationError` before sending.
- How Node's `fetch` surfaces such a status is the `(M2B)` probe; the unit
  tests only fix the mapping for a response that does arrive.

**Definition of done**
- [x] Encaps: body `{kid}`; result fields as bytes; 406 raises
      `HemOperationFailedError`.
- [x] Decaps: body `{kid, ct}`; wrong ciphertext length raises
      `HemValidationError`; the result has no algorithm field whatever the
      response contains.
- [x] ML-DSA sign: body `{kid, msg}` plus `ctx`; a context over 255 bytes
      raises `HemValidationError`.
- [x] ML-DSA verify: 200 → `true`; 401/403 raise; a response with status
      795 (and with 406) → `false`; an over-size body raises
      `HemValidationError` before sending.
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
