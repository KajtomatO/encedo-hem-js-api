---
id: STEP-M2B-040
title: ECDH and agreed-key mode live
milestone: M2B
implements: ["REQ-OPS-010", "REQ-OPS-015"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-030"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The device's ECDH secret equals the one computed locally; the agreed-key mode round-trips and its HMAC equals a local one.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/ecdh.test.ts`. Device effects: creates an X25519 and a
  `SECP384R1` key; generates a local X25519 pair with Web Crypto; the
  device's raw secret (peer as raw bytes) equals the local
  `deriveBits` result (REQ-OPS-010); records the raw output length for the
  P-384 key against a locally generated P-384 peer (quirk 9); agreed-key
  encrypt (GCM) then decrypt with the same pair and context returns the
  message (REQ-OPS-015); agreed-key HMAC with `alg: SHA2-256` equals
  HMAC-SHA256 computed locally with the ECDH secret as the key. Deletes
  the keys.

**Definition of done**
- [ ] X25519 raw secret equals the local one; P-384 raw length recorded.
- [ ] Agreed-key encrypt/decrypt round-trips; agreed-key HMAC equals the
      local HMAC.
- [ ] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [ ] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [ ] No `EHEMTEST` key remains on the device.
