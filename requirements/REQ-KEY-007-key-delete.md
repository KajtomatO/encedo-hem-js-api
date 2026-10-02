---
id: REQ-KEY-007
title: Delete a key
status: approved
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
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
Introduced in M2.

**Acceptance criteria:**
- [ ] The scope used is `keymgmt:del`; a 200 with an empty body resolves the
      call.
- [ ] A 406 (key not present) raises `HemOperationFailedError`.
- [ ] A cached `keymgmt:use:<kid>` token for the deleted key is discarded.
- [ ] (M2B) a test key is deleted and no longer appears in the list.
