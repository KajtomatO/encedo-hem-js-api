---
id: REQ-SYS-031
title: Expose a storage slot
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.6; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-api-doc; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Expose a storage slot

The library SHALL provide one call that takes the storage slot and the
access mode from the caller and exposes that slot to the USB host.

Read-only uses `GET /api/storage/unlock/ro` with scope `storage:disk<N>`;
read-write uses `GET /api/storage/unlock/rw` with scope
`storage:disk<N>:rw`. The plain `GET /api/storage/unlock`, where the mode
follows from the scope alone, is covered by the same call and not exposed
separately.

**Rationale:** The device reads slot and mode from the token's scope [YAML],
so the call has to obtain the matching scope itself. Sources differ on the
paths: [DOC] records one official client using the suffixed paths and
another the plain one. [C-SDK] records a firmware defect in these handlers
(an uninitialised value is read), so their behaviour is not fully
predictable. Introduced in M3.

**Acceptance criteria:**
- [ ] Slot and mode map to path and scope as stated.
- [ ] A slot other than 0 or 1, or an unknown mode, raises
      `HemValidationError`.
- [ ] A 406 raises `HemOperationFailedError`.
- [ ] The documentation states that the operation needs mass-storage
      hardware.
- [ ] (M3B) attended: exercised only if the user decides to; which path
      variants the device accepts is recorded.
