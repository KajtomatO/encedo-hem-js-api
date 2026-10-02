---
id: STEP-M1A-020
title: CI workflow and static source checks
milestone: M1A
implements: ["REQ-BUILD-003", "REQ-BUILD-005", "REQ-API-009"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout", "ARCHITECTURE.md#1-decisions-fixed"]
depends_on: ["STEP-M1A-010"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** A workflow under `.github/workflows/` runs install, build,
type-check and the Node and browser unit runs on every push and pull
request; one npm script runs the same checks locally; a static check over
`src/` enforces the platform-API and no-secret-output rules.

**Notes:** The static check is a unit test or script that scans `src/` for:
`node:` imports, bare module specifiers, `Buffer`, `process`, `require`
(REQ-BUILD-003); `console.*`, web storage, IndexedDB, file and
environment-variable access (REQ-API-009, static criterion). The workflow
holds no secrets and runs no integration or attended test. The leak tests
on login and authenticated-call errors (REQ-API-009) are in STEP-M1A-090
and STEP-M1A-180.

**Definition of done**
- [ ] The workflow runs install, build, type-check and both unit runs on push and pull request, on Node 24
- [ ] The workflow runs no integration or attended test and holds no device credentials
- [ ] One npm script runs the same checks locally; the A gate uses that script
- [ ] The static check fails on `node:` imports, bare module specifiers, `Buffer`, `process` or `require` in `src/`
- [ ] The static check fails on console output and on web storage, IndexedDB, file or environment-variable access in `src/`
- [ ] The checks are tagged `verifies: REQ-BUILD-003` and `verifies: REQ-API-009`
