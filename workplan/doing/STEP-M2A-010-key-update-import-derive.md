---
id: STEP-M2A-010
title: Key update, import, derive
milestone: M2A
implements: ["REQ-KEY-006", "REQ-KEY-008", "REQ-KEY-009"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] Update: body `{kid, label}` plus `descr`; scope `keymgmt:upd`; the
      description cannot be left unstated; 406 raises
      `HemOperationFailedError`.
- [ ] Import: body `{label, pubkey, type}` plus `mode` and `descr` when
      given; scope `keymgmt:imp`; the result is the key id; a symmetric type
      raises `HemValidationError`; 406 names a duplicate key.
- [ ] Derive: body `{kid, label, type}` plus one of `ext_kid`/`pubkey` and
      `mode`/`descr` when given; scope `keymgmt:gen`; both peers, neither, or
      a target type outside the list raise `HemValidationError` before
      sending; an echoed source key id raises `HemProtocolError`.
- [ ] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [ ] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [ ] `npm run surface:update` adds entries only; `npm run check` passes.
