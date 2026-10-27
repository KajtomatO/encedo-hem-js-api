---
id: STEP-M2B-020
title: Signatures and MACs live
milestone: M2B
implements: ["REQ-OPS-005", "REQ-OPS-006", "REQ-OPS-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-010"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** HMAC verify, ExDSA sign and verify run on the test device; the signatures verify locally with Web Crypto and the ECDSA encoding is recorded.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/signatures.test.ts`. Device effects: creates a
  `SHA2-256` key, a `SECP256R1` key with mode `ExDSA` and an `ED25519` key;
  HMAC then HMAC verify of the same MAC (`true`) and of an altered MAC
  (`false`); signs with `SHA256WithECDSA` and `Ed25519`; verifies both on
  the device (`true`, and `false` over a different message); verifies both
  locally with Web Crypto from the public keys `keys.get` returns (P-256:
  the device's DER signature converted to the raw r||s form Web Crypto
  takes; record that the encoding is DER). Deletes the keys.
- Node 24's Web Crypto supports Ed25519 and P-256; the compressed X9.63
  public key of the P-256 key needs decompression or an import as JWK —
  decide in the test and note it.

**Definition of done**
- [ ] HMAC verify: `true` for the device's own MAC, `false` for an altered
      one.
- [ ] Sign: P-256 and Ed25519 signatures verify locally; ECDSA encoding
      recorded in REQ-OPS-006.
- [ ] Verify: `true` for the device's signature, `false` over another
      message.
- [ ] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [ ] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [ ] No `EHEMTEST` key remains on the device.
