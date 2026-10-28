---
id: STEP-M2B-075
title: SECP keys get mode ECDH by default on create, import and derive
milestone: M2B
implements: ["REQ-KEY-001", "REQ-KEY-008", "REQ-KEY-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-070"]
evidence:
  commits: ["2b93ad3", "ac13b18"]
  tests: ["verifies: REQ-KEY-001, REQ-KEY-008, REQ-KEY-009 (tests/unit/keys-create-get.test.ts, tests/unit/keys-update-import-derive.test.ts; tests/integration/keys-secp-mode.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 4/4 passed in 12.6 s. A SECP256R1 key created without mode is listed ATT,PKEY,ECDH,SECP256R1 and gives a 32-byte secret against a local P-256 peer; a local P-256 public key imported without mode is listed ECDH,SECP256R1 and, as extKid, gives the same secret as the raw form; mode ExDSA is kept (ATT,PKEY,ExDSA,SECP256R1). Derive: firmware 1.2.2 refuses every SECP* target with 406 — probed with no mode, ECDH and ECDH,ExDSA from X25519 and P-256 sources, while CURVE25519, ED25519, AES256 and SHA2-256 targets derive (new quirk 21); the REQ-KEY-009 (M2B) box stays open for the user. Two probe anomalies (an imported peer refused by key id, a raw peer refused) were both the quirk-12 duplicate of a derivation made moments before from the same material, not a peer-form rule. npm run check: 99 files, 2107 tests; surface unchanged. All EHEMTEST keys deleted."
reopened: []
cancelled: null
---

**Goal:** A `SECP*` key created, imported or derived through the library without a `mode` is usable for ECDH: the library sends `mode: ECDH` unless the caller gives one.

**Notes:**
- Created at the §6.2 impact analysis approved on 2026-10-27 (user decision
  after STEP-M2B-040: a `SECP*` key created without `mode` has no usage
  flag and can neither sign nor run ECDH — ARCHITECTURE.md §6 quirk 11).
  REQ-KEY-001 (rev 6), REQ-KEY-008 (rev 4) and REQ-KEY-009 (rev 5) were set
  to `needs-reverify` with the reworded first criterion; the done steps
  that implemented them (STEP-M1A-160, STEP-M2A-010, STEP-M1B-060,
  STEP-M2B-010) are not reopened — this step carries the rework.
- Code: `keys.create`, `keys.import`, `keys.derive` in `src/api/keymgmt.ts`
  send `mode: 'ECDH'` when `type` starts with `SECP` and `params.mode` is
  undefined; never a mode for other types; an explicit mode is kept and
  still validated. The public surface is unchanged (REQ-API-008). TSDoc of
  the three `mode` fields, `keys.create`, `keys.import` and `crypto.ecdh`;
  README "Daily usage", CHANGELOG 0.2.0, quirk 11 handling column.
- Unit tests: `tests/unit/keys-create-get.test.ts`,
  `tests/unit/keys-update-import-derive.test.ts`.
- B part (one live run, `tests/integration/keys-secp-mode.test.ts`). Device
  effects: creates a `SECP256R1` key without a mode and checks it is listed
  with the `ECDH` flag and completes an ECDH against a local P-256 peer;
  imports that local public key without a mode and uses it as `extKid`;
  derives a `SECP256R1` key without a mode and checks its flag; a key
  created with `mode: ExDSA` is listed without `ECDH` (the explicit mode is
  kept). All keys `EHEMTEST`-labelled and deleted.

**Definition of done**
- [x] The three bindings default `mode` to `ECDH` for `SECP*` types only;
      unit tests cover the default, an explicit mode and a non-`SECP` type;
      `npm run check` passes with the surface unchanged.
- [x] The integration test passes live; the summary is in `evidence.notes`.
- [x] The reworded criteria and the new `(M2B)` boxes of REQ-KEY-001/008/009
      are ticked with their findings; docs updated — except the REQ-KEY-009
      `(M2B)` box, not observable on firmware 1.2.2 (quirk 21), left to the
      user.
