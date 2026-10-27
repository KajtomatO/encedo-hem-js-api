---
id: STEP-M2B-010
title: Keys live: update, import, derive, echo probe
milestone: M2B
implements: ["REQ-KEY-006", "REQ-KEY-008", "REQ-KEY-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: []
evidence:
  commits: ["93f70e3", "0f02d4f", "c5d1260"]
  tests: ["verifies: REQ-KEY-006, REQ-KEY-008, REQ-KEY-009 (tests/integration/keys-m2.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 5/5 passed in 17.0 s; the two echo probes then re-run alone, 2/2. Update: new label and 19-byte description read back through list; after an empty-description update the entry has no descr; unknown kid → 406. Import: X25519 public key stored as ECDH,CURVE25519 (no PKEY), keys.get returns the same 32 bytes; second import → 406. Derive: AES256 key listed; same derivation again → 406 (quirk 12). Echo probe (user decision to add the second variant): EHEMTEST-NOT-A-TYPE → 400; MLKEM768 → 200 echoing the source kid, no key created — quirk 4 confirmed and its description sharpened in ARCHITECTURE.md §6. Scopes accepted: keymgmt:gen (create, derive), keymgmt:upd, keymgmt:imp, keymgmt:list, keymgmt:use:<kid> (get), keymgmt:del. All EHEMTEST keys deleted; the sweep found none left."
reopened: []
cancelled: null
---

**Goal:** Key update, import and derive run on the test device; the derive echo quirk is probed and recorded.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/keys-m2.test.ts`. Device effects: creates X25519
  (`CURVE25519`) test keys; renames one and clears its description, reading
  both back through list (REQ-KEY-006); imports a locally generated X25519
  public key and imports it again, expecting 406 (REQ-KEY-008); derives an
  `AES256` key from two X25519 keys and finds it in the list (REQ-KEY-009);
  then sends one derive with an unrecognised `type` through the binding
  core directly (bypassing the library's validation) and records whether
  the device echoes the source key id (quirk 4). Deletes everything it
  created, including whatever the probe may have created.
- Record the scope each call was accepted with.

**Definition of done**
- [x] Update: label and description changed and read back; cleared
      description confirmed.
- [x] Import: a fresh X25519 public key imported; the second import refused
      (status recorded).
- [x] Derive: a key derived from two X25519 keys appears in the list; the
      echo probe's result recorded in REQ-KEY-009 and §6 quirk 4.
- [x] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [x] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [x] No `EHEMTEST` key remains on the device.
