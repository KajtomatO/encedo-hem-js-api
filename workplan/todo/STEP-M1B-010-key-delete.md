---
id: STEP-M1B-010
title: Key delete binding
milestone: M1B
implements: ["REQ-KEY-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#52-session-behaviour"]
depends_on: []
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.keys.delete(kid)` removes one key through
`DELETE /api/keymgmt/delete/{kid}`, with unit tests, so that the M1B harness
can delete the keys it creates.

**Notes:**
- Moved from M2A by user decision 2026-10-06 (impact analysis at the M1B
  decomposition): without delete, keys created by device tests would
  accumulate on the device.
- Scope `keymgmt:del` [YAML]. The operation is TLS-only (REQ-NET-003): over
  plain HTTP the device would answer 409 instead of 418 (ARCHITECTURE.md §6
  quirk 1), which the guard pre-empts by refusing before sending.
- A 406 means the key is not present → `HemOperationFailedError`.
- After a successful delete the cached `keymgmt:use:<kid>` token for that
  key is discarded (REQ-KEY-007). The session engine gets a per-scope forget
  for this; the public surface grows only by `keys.delete`.
- Implementation-and-unit-test work (A-type) inside a B part: no device, no
  network. The live check is STEP-M1B-060.
- TSDoc states scope and milestone (REQ-API-007); the surface snapshot gains
  exactly the new entries (REQ-API-008); the README operation list is
  updated.

**Definition of done**
- [ ] `keys.delete(kid)`: method `DELETE`, path `/api/keymgmt/delete/{kid}`,
      scope `keymgmt:del`; a 200 with an empty body resolves the call.
- [ ] An invalid kid raises `HemValidationError`, and an `http:` client
      raises `HemTlsRequiredError`, each with zero `fetch` calls.
- [ ] A 406 raises `HemOperationFailedError`.
- [ ] After a delete, the next call needing `keymgmt:use:<kid>` for that kid
      logs in again; tokens for other scopes are kept.
- [ ] Unit tests assert method, path, headers, body and response mapping;
      TSDoc states scope and milestone; the surface snapshot changes only by
      the new entries; the README lists the operation.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for REQ-KEY-007; its
      non-`(M1B)` boxes are ticked (revision bumped).
