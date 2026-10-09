---
id: REQ-KEY-007
title: Delete a key
status: approved
priority: must
revision: 4
source: start_point §4; ref/api/hem-api-1.2.2.yaml; user decision 2026-10-06 (moved from M2A to M1B)
depends_on: ["REQ-AUTH-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Delete a key

The library SHALL provide a call for `DELETE /api/keymgmt/delete/{kid}` that
deletes one key.

**Rationale:** The key lifecycle ends with deletion. It is also how a
mobile-app pairing is removed, since pairings are stored as keys [YAML].
Introduced in M1B — moved from M2A at the M1B decomposition so that device
tests can delete the keys they create (user decision 2026-10-06).

**Acceptance criteria:**
- [x] The scope used is `keymgmt:del`; a 200 with an empty body resolves the
      call.
- [x] A 406 (key not present) raises `HemOperationFailedError`.
- [x] A cached `keymgmt:use:<kid>` token for the deleted key is discarded.
- [x] (M1B) a test key is deleted and no longer appears in the list —
      2026-10-09: gone from `listAll` after the delete; a second delete of
      the same key answered 406 → `HemOperationFailedError`. Every key the
      run created was deleted again.
