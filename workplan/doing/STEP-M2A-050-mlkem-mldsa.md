---
id: STEP-M2A-050
title: ML-KEM encaps and decaps, ML-DSA sign and verify
milestone: M2A
implements: ["REQ-OPS-011", "REQ-OPS-012", "REQ-OPS-013", "REQ-OPS-014"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2A-020"]
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] Encaps: body `{kid}`; result fields as bytes; 406 raises
      `HemOperationFailedError`.
- [ ] Decaps: body `{kid, ct}`; wrong ciphertext length raises
      `HemValidationError`; the result has no algorithm field whatever the
      response contains.
- [ ] ML-DSA sign: body `{kid, msg}` plus `ctx`; a context over 255 bytes
      raises `HemValidationError`.
- [ ] ML-DSA verify: 200 → `true`; 401/403 raise; a response with status
      795 (and with 406) → `false`; an over-size body raises
      `HemValidationError` before sending.
- [ ] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [ ] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [ ] `npm run surface:update` adds entries only; `npm run check` passes.
