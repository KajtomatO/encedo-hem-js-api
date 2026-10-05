---
id: STEP-M1A-030
title: Static source checks and CI workflow
milestone: M1A
implements: ["REQ-BUILD-003", "REQ-BUILD-005", "REQ-BUILD-004", "REQ-TEST-002", "REQ-API-009"]
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1A-020"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** A test fails when `src/` imports anything from outside itself or
uses a Node-only or secret-leaking API; one npm script runs the whole A-gate
check locally, and a CI workflow runs that same script.

**Notes:**
- The static check scans the text of `src/`. For REQ-BUILD-003: no `node:`
  import, no bare module specifier, no `Buffer`, `process` or `require`;
  cryptography only through `globalThis.crypto`, networking only through
  `fetch`. For REQ-API-009 (first criterion only): no console output and no
  persistent storage — web storage, IndexedDB, files, environment variables.
- The check needs a proof that it can fail: run the checker against small
  bad samples in the test, not only against the clean tree.
- The workflow cannot be observed running from this machine, because nothing
  is pushed (CLAUDE.md). The A gate relies on the local script
  (REQ-BUILD-005, third criterion).
- Partly closed here: REQ-BUILD-004 (CI runs on Node 24), REQ-TEST-002 (CI
  runs both unit runs), REQ-API-009 (static check; its error-inspection
  criteria close in STEP-M1A-120 and STEP-M1A-130).

**Definition of done**
- [ ] A static-check test fails on a `node:` import, a bare module specifier,
      or a use of `Buffer`, `process` or `require` in `src/`; the test proves
      this on bad samples.
- [ ] The same check fails on console output and on use of persistent storage
      or environment variables in `src/`.
- [ ] `.github/workflows/ci.yml` runs install, build, type-check and both unit
      runs on Node 24 on every push and pull request; it runs no integration
      or attended test and holds no device credentials.
- [ ] One npm script runs build, type-check and both unit runs; the workflow
      calls that script.
- [ ] The script passes locally.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
