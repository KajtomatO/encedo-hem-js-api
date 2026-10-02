---
id: REQ-API-007
title: Every public operation documents its scope and milestone
status: approved
priority: must
revision: 1
source: start_point G23
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
---

# Every public operation documents its scope and milestone

Every public operation SHALL carry documentation stating the token scope it
requires and the milestone that introduced it.

**Rationale:** Scopes decide what a token is allowed to do, so an integrator
needs to see them without reading the source. The milestone tells which
release an operation first appeared in. Introduced in M1.

**Acceptance criteria:**
- [ ] An automated check over the public API fails for any operation whose
      documentation lacks the scope or the milestone.
- [ ] Operations that need no token state the scope as none.
- [ ] The documentation comments are present in the published type
      declarations.
