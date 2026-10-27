---
id: STEP-M2B-075
title: SECP keys get mode ECDH by default on create, import and derive
milestone: M2B
implements: ["REQ-KEY-001", "REQ-KEY-008", "REQ-KEY-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-070"]
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] The three bindings default `mode` to `ECDH` for `SECP*` types only;
      unit tests cover the default, an explicit mode and a non-`SECP` type;
      `npm run check` passes with the surface unchanged.
- [ ] The integration test passes live; the summary is in `evidence.notes`.
- [ ] The reworded criteria and the new `(M2B)` boxes of REQ-KEY-001/008/009
      are ticked with their findings; docs updated.
