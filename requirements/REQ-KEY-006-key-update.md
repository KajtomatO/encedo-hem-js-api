---
id: REQ-KEY-006
title: Change a key's label or description
status: draft
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Change a key's label or description

The library SHALL provide a call for `POST /api/keymgmt/update` that sets a
key's label and description, both stated explicitly by the caller.

**Rationale:** The device rewrites the whole record: the label is always
required, and leaving the description out clears it [YAML], [C-SDK]. A call
with an optional description would erase data by accident, so the caller has
to say what the description becomes — new bytes, or deliberately empty.
Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, label}` plus `descr` when a description is given;
      the scope used is `keymgmt:upd`.
- [ ] The call cannot be made without stating the description (bytes, or an
      explicit empty value).
- [ ] A 406 (for example an unknown key id) raises
      `HemOperationFailedError`.
- [ ] (M2B) a test key's label and description are changed and read back
      through list; clearing the description is confirmed.
