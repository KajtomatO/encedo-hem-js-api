---
id: REQ-BUILD-005
title: Continuous integration for build and unit tests
status: verified
priority: must
revision: 1
source: ARCHITECTURE.md §8; ARCHITECTURE.md §1
depends_on: ["REQ-TEST-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout"]
---

# Continuous integration for build and unit tests

A continuous-integration workflow SHALL build the package, type-check it and
run the unit suite in Node.js 24 and in a headless browser on every push and
pull request.

**Rationale:** The A gate is defined by these checks, so they need one
scripted definition that runs the same way locally and in CI. Introduced in
M1.

**Acceptance criteria:**
- [ ] A workflow file under `.github/workflows/` runs install, build,
      type-check and both unit runs.
- [ ] The workflow runs no integration or attended test and holds no device
      credentials.
- [ ] One npm script runs the same checks locally; the A gate uses that
      local run.
