---
id: STEP-M2B-050
title: Post-quantum live and the ML-DSA status probe
milestone: M2B
implements: ["REQ-OPS-011", "REQ-OPS-012", "REQ-OPS-013", "REQ-OPS-014"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2B-040"]
evidence:
  commits: ["7414eaa", "1cee8d0"]
  tests: ["verifies: REQ-OPS-011, REQ-OPS-012, REQ-OPS-013, REQ-OPS-014 (tests/integration/pqc.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 3/3 passed in 13.9 s. Key generation: MLKEM768 2.5 s, MLDSA65 0.3 s (well inside the default limit; the TSDoc warning stays as a caution). ML-KEM: ss 32, ct 1088, decaps equal; decaps alg field = 'keymgmt:use:<kid>' (the token scope — quirk 2 content recorded); tampered ciphertext → a different secret, no error. ML-DSA: 3309-byte signatures, context honoured (verify without the context → false). Bad signature: the device answers status line 795 in 0.3 s; node:https delivers HemDeviceError status 795; mldsaVerify → false; §11 risk 2 RESOLVED for Node, browsers unprobed. This commit also carries the crypto.ecdh TSDoc correction left over from STEP-M2B-040 (its edit script stopped before that file). All EHEMTEST keys deleted."
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
- [x] ML-KEM: secrets equal; lengths and `alg` content recorded.
- [x] ML-DSA: signature length recorded; good signature `true`; bad
      signature: observed behaviour recorded and the `false` mapping
      confirmed or a revision proposed; §11 risk 2 resolved.
- [x] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [x] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [x] No `EHEMTEST` key remains on the device.
