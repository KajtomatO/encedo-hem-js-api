---
id: STEP-M2B-050
title: Post-quantum live and the ML-DSA status probe
milestone: M2B
implements: ["REQ-OPS-011", "REQ-OPS-012", "REQ-OPS-013", "REQ-OPS-014"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2B-040"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** ML-KEM and ML-DSA run on the test device; the lengths and the decaps `alg` content are recorded; what the Node transport reports for a failed ML-DSA verification is recorded and §11 risk 2 resolved.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/pqc.test.ts`. Device effects: creates an `MLKEM768`
  and an `MLDSA65` key (pass a larger `timeoutMs`; record the generation
  times); encaps then decaps give the same secret; lengths (ss 32, ct
  1088) and the raw `alg` string of the decaps reply (read through the
  binding core, since the library hides it) recorded; ML-DSA sign (length
  3309 expected) and verify `true`; then a bad signature: record the exact
  status line or error the Node transport sees and that the library
  answers `false`. Deletes the keys.
- If the device hangs or closes the connection on the bad signature
  instead of answering, record it and propose the REQ-OPS-014 change for
  the user.

**Definition of done**
- [ ] ML-KEM: secrets equal; lengths and `alg` content recorded.
- [ ] ML-DSA: signature length recorded; good signature `true`; bad
      signature: observed behaviour recorded and the `false` mapping
      confirmed or a revision proposed; §11 risk 2 resolved.
- [ ] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [ ] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [ ] No `EHEMTEST` key remains on the device.
