---
id: STEP-M2B-040
title: ECDH and agreed-key mode live
milestone: M2B
implements: ["REQ-OPS-010", "REQ-OPS-015"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-030"]
evidence:
  commits: ["2060f97", "19bcf8a"]
  tests: ["verifies: REQ-OPS-010, REQ-OPS-015 (tests/integration/ecdh.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 5/5 passed in 30.5 s (after three probe rounds for the P-384 case). X25519 raw secret equals Web Crypto's, 32 bytes; SHA2-384 form is the digest of that secret. Agreed-key GCM round-trips, other ctx → 406; agreed wrap 32→40 and back; agreed HMAC-SHA256 equals the local HMAC keyed with the raw secret. P-384: 32 bytes raw (quirk 9 confirmed, also for Curve448) — but only once the key was created with mode ECDH: a SECP key created without mode has no ECDH flag in its listed type (ATT,PKEY,SECP384R1) and every ECDH with it is 406, as is signing (STEP-M2B-020). That contradicts the C SDK's 'ECDH-only default' (device wins): quirk 11 corrected in ARCHITECTURE.md §6, REQ-KEY-001 rationale, keys.create/import TSDoc and crypto.ecdh TSDoc. Also: a raw SECP peer must be compressed X9.63 (uncompressed → 406); a SECP peer imported without mode cannot be an ext_kid (406). Open for the user: whether keys.create/import should default mode to ECDH for SECP types (a behaviour change, not done). All EHEMTEST keys deleted."
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
- [x] X25519 raw secret equals the local one; P-384 raw length recorded.
- [x] Agreed-key encrypt/decrypt round-trips; agreed-key HMAC equals the
      local HMAC.
- [x] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [x] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [x] No `EHEMTEST` key remains on the device.
