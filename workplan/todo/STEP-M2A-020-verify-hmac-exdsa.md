---
id: STEP-M2A-020
title: Verify semantics, HMAC verify, ExDSA sign and verify
milestone: M2A
implements: ["REQ-OPS-004", "REQ-OPS-005", "REQ-OPS-006", "REQ-OPS-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.crypto` offers HMAC verify, ExDSA sign and ExDSA verify; verify operations return `true` or `false` and raise only for other failures.

**Notes:**
- `src/api/crypto.ts`; scope `keymgmt:use:<kid>` for all three; TLS-only.
- REQ-OPS-004: the device reports a mismatch with 406, the same status as a
  missing or wrong-type key [C-SDK]; the binding maps 200 → `true`, the
  mismatch response → `false`, and 400/401/403/409 and transport failures
  to their error classes. Put the shared mapping in one helper so ML-DSA
  verify (STEP-M2A-050) can reuse the `true` path with its own `false` rule.
  The TSDoc of every verify operation states that `false` also covers a
  missing or unsuitable key.
- HMAC verify (`POST /api/crypto/hmac/verify`): body `{kid, msg, mac}`; a
  MAC over 64 bytes raises `HemValidationError`; `alg` is not sent in
  stored-key mode (quirk 10, as for HMAC hash).
- ExDSA sign (`POST /api/crypto/exdsa/sign`): algorithms `SHA256WithECDSA`,
  `SHA384WithECDSA`, `SHA512WithECDSA`, `Ed25519`, `Ed25519ph`,
  `Ed25519ctx`, `Ed448`, `Ed448ph`; `ctx` up to 255 bytes, only with the
  `ph`/`ctx` variants. Result: the signature as bytes; the TSDoc states DER
  for ECDSA, raw for EdDSA [C-SDK], and that a `SECP*` key needs the `ExDSA`
  mode (quirk 11).
- ExDSA verify (`POST /api/crypto/exdsa/verify`): body `{kid, msg, sign,
  alg}` plus `ctx`.
- Message limits as for HMAC hash unless the reference says otherwise.

**Definition of done**
- [ ] A verify helper maps 200 → `true` and the device's mismatch response
      → `false`; other statuses and transport failures raise; tested once
      for each verify operation of this step.
- [ ] HMAC verify: body `{kid, msg, mac}`, scope `keymgmt:use:<kid>`; a MAC
      longer than 64 bytes raises `HemValidationError`.
- [ ] ExDSA sign: body `{kid, msg, alg}` plus `ctx`; an algorithm outside
      the list or a context over 255 bytes raises `HemValidationError`; the
      result is the signature as bytes; TSDoc states the encoding per key
      family and the `ExDSA` mode note.
- [ ] ExDSA verify: body `{kid, msg, sign, alg}` plus `ctx`; result per
      REQ-OPS-004.
- [ ] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [ ] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [ ] `npm run surface:update` adds entries only; `npm run check` passes.
