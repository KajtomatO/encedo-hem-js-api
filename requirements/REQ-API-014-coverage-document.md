---
id: REQ-API-014
title: Coverage document for all 58 operations
status: approved
priority: must
revision: 1
source: start_point §5; start_point G23; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#10-milestones"]
---

# Coverage document for all 58 operations

The repository SHALL contain a coverage document that maps every operation
of the 1.2.2 reference to the public call that covers it.

**Rationale:** After the last milestone the library is meant to cover all 58
operations. Several are hidden behind one call (the list and unlock path
variants), so coverage has to be shown explicitly rather than counted.
Introduced in M3.

**Acceptance criteria:**
- [ ] A unit test reads the operation ids from the reference and fails if
      any is missing from the document.
- [ ] Path variants covered by one call are listed under that call.
- [ ] The document states what is excluded and why: everything under
      `/api/diag/`, and endpoints not in the 1.2.2 reference.
