---
id: REQ-SYS-030
title: Hide a storage slot
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.6; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Hide a storage slot

The library SHALL provide a call for `GET /api/storage/lock` that takes the
storage slot from the caller and hides that slot from the USB host.

**Rationale:** The device reads the slot from the token's scope, not from
the URL [YAML]. The call therefore obtains a token whose scope names the
slot. Introduced in M3.

**Acceptance criteria:**
- [ ] For slot N (0 or 1) the scope used is `storage:disk<N>`.
- [ ] Any other slot value raises `HemValidationError`.
- [ ] A 406 (invalid slot in the scope) raises `HemOperationFailedError`.
- [ ] The documentation states that the operation needs mass-storage
      hardware.
- [ ] (M3B) attended: exercised only if the user decides to, since it
      changes what the USB host sees.
