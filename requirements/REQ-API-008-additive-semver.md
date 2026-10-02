---
id: REQ-API-008
title: Public API only grows between releases
status: approved
priority: must
revision: 1
source: start_point G4; ARCHITECTURE.md §4
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#1-decisions-fixed"]
---

# Public API only grows between releases

A release SHALL NOT remove or incompatibly change any public export of an
earlier release.

**Rationale:** Each milestone is a usable release, and a consumer that
adopted the MVP must be able to take later milestones without rework.
Introduced in M1.

**Acceptance criteria:**
- [ ] A snapshot of the public surface (exported names and signatures) is
      committed in the repository.
- [ ] A unit test fails when an entry of the snapshot changes or disappears,
      and passes when entries are only added.
- [ ] The snapshot is frozen as the baseline when a release is cut
      (REQ-BUILD-006).
