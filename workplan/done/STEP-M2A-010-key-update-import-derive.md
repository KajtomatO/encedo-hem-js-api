---
id: STEP-M2A-010
title: Key update, import, derive
milestone: M2A
implements: ["REQ-KEY-006", "REQ-KEY-008", "REQ-KEY-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: ["73fdf2b"]
  tests: ["verifies: REQ-KEY-006 (tests/unit/keys-update-import-derive.test.ts)", "verifies: REQ-KEY-008 (tests/unit/keys-update-import-derive.test.ts)", "verifies: REQ-KEY-009 (tests/unit/keys-update-import-derive.test.ts)"]
  notes: "npm run check on 2026-10-27: 86 files, 1503 tests passed in Node v24.21.0 and headless Chromium (1329 before). Surface snapshot grew by 25 entries, additions only (KeysApi.update/import/derive, the three Params interfaces, KeyPeer, IMPORTABLE_KEY_TYPES, DERIVABLE_KEY_TYPES and their types). The peer parameter is `peer: { extKid } | { pubkey }` in src/api/peer.ts, shared with STEP-M2A-040. Update clears the description by omitting the field when `descr` is empty (quirk 5). Import's 406 message names a duplicate key among the causes via copyError. Derive raises HemProtocolError when the returned id equals the source id (quirk 4). The derive scope is keymgmt:gen per REQ-KEY-009 (the reference also lists keymgmt:derive). The (M2B) boxes of the three REQs stay open."
reopened: []
cancelled: null
---

**Goal:** `client.keys` offers update, import and derive, each with its own scope and its inputs checked before anything is sent.

**Notes:**
- `src/api/keymgmt.ts`. Scopes [YAML]: update `keymgmt:upd`, import
  `keymgmt:imp`, derive `keymgmt:gen`. All three are TLS-only (REQ-NET-003).
- Update (`POST /api/keymgmt/update`): the device rewrites the whole record
  and omitting `descr` clears it (§6 quirk 5), so the call takes `label` and
  `descr` both explicitly; an empty description is sent as the explicit
  empty value the reference allows. Reuse the label/description validators
  of key create.
- Import (`POST /api/keymgmt/import`): importable types are the `SECP*`,
  `CURVE*`, `ED*`, `MLKEM*` and `MLDSA*` entries of `KEY_TYPES`; symmetric
  types raise `HemValidationError`. No size limit of its own on `pubkey`
  beyond the body limit. A 406 is `HemOperationFailedError` whose message
  names a duplicate key among the causes (quirk 12).
- Derive (`POST /api/keymgmt/derive`): exactly one of `ext_kid` or `pubkey`;
  target types are those of create minus `MLKEM*`/`MLDSA*`. A reply whose
  key id equals the source key id is `HemProtocolError` (quirk 4).
- Take the response field names from `ref/api/hem-api-1.2.2.yaml`.

**Definition of done**
- [x] Update: body `{kid, label}` plus `descr`; scope `keymgmt:upd`; the
      description cannot be left unstated; 406 raises
      `HemOperationFailedError`.
- [x] Import: body `{label, pubkey, type}` plus `mode` and `descr` when
      given; scope `keymgmt:imp`; the result is the key id; a symmetric type
      raises `HemValidationError`; 406 names a duplicate key.
- [x] Derive: body `{kid, label, type}` plus one of `ext_kid`/`pubkey` and
      `mode`/`descr` when given; scope `keymgmt:gen`; both peers, neither, or
      a target type outside the list raise `HemValidationError` before
      sending; an echoed source key id raises `HemProtocolError`.
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
