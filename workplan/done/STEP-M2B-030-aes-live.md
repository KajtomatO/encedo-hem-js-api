---
id: STEP-M2B-030
title: AES live
milestone: M2B
implements: ["REQ-OPS-008", "REQ-OPS-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-020"]
evidence:
  commits: ["85bbeb0", "8f6487b"]
  tests: ["verifies: REQ-OPS-008, REQ-OPS-009 (tests/integration/cipher.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 6/6 passed. ECB 32→32 bytes, no IV; CBC 47→48 bytes with a 16-byte IV (device pads); GCM 47→47 bytes, 16-byte IV and tag; fresh IV per GCM call; altered tag → 406, other AAD → 406; AES256 algorithm on an AES128 key → 406. All EHEMTEST keys deleted."
reopened: []
cancelled: null
---

**Goal:** Encrypt and decrypt run on the test device in ECB, CBC and GCM mode with an AES-256 key; IV and tag lengths are recorded.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/cipher.test.ts`. Device effects: creates an `AES256`
  key; for each mode encrypts a message (a 32-byte one for ECB) and
  decrypts the result back; records the IV and tag lengths; a GCM message
  with one altered tag byte fails (status recorded, expected 406); the
  CBC ciphertext length shows the device's padding. Deletes the key.

**Definition of done**
- [x] Each mode round-trips; IV and tag lengths recorded in REQ-OPS-008.
- [x] Altered GCM tag fails with the recorded status (REQ-OPS-009).
- [x] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [x] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [x] No `EHEMTEST` key remains on the device.
