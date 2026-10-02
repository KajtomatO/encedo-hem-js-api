---
id: REQ-BUILD-006
title: A versioned release at the end of each milestone
status: draft
priority: must
revision: 1
source: start_point G4; ARCHITECTURE.md §4
depends_on: ["REQ-API-008", "REQ-BUILD-001"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#10-milestones"]
---

# A versioned release at the end of each milestone

Each milestone SHALL end in a release whose version is recorded in
`package.json` and in a changelog entry.

**Rationale:** Each milestone is meant to be usable on its own. A version
and a changelog are what tell a consumer which operations it has. Introduced
in M1B.

**Acceptance criteria:**
- [ ] The version is 0.1.0 after the M1B gate, 0.2.0 after M2B and 1.0.0
      after M3B.
- [ ] The changelog entry lists the operations the release adds.
- [ ] The packed archive installs into an empty Node 24 project and imports.
- [ ] The package name is decided before 0.1.0 (ARCHITECTURE.md §11, risk
      12).
- [ ] Tagging and publishing are done by the user.
