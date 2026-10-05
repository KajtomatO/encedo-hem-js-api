---
id: STEP-M1A-030
title: Static source checks and CI workflow
milestone: M1A
implements: ["REQ-BUILD-003", "REQ-BUILD-005", "REQ-BUILD-004", "REQ-TEST-002", "REQ-API-009"]
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1A-020"]
evidence:
  commits: ["c9166bd", "22be228"]
  tests: ["verifies: REQ-BUILD-003 (tests/unit/source-check.test.ts, tests/unit/source-tree.node.test.ts)", "verifies: REQ-API-009 (tests/unit/source-check.test.ts, tests/unit/source-tree.node.test.ts)", "verifies: REQ-BUILD-005 (tests/unit/ci.node.test.ts)", "verifies: REQ-BUILD-004 (tests/unit/ci.node.test.ts)", "verifies: REQ-TEST-002 (tests/unit/ci.node.test.ts)", "supports: REQ-BUILD-003, REQ-API-009 (tests/support/source-check.ts)"]
  notes: "npm run check (build, typecheck, Vitest in Node v24.21.0 and headless Chromium): 13 files, 106 tests passed. The workflow has not been observed running on GitHub because nothing is pushed (CLAUDE.md); the A gate relies on the local script. REQ-API-009 gets no implements: tag here: this step adds only its static check (under tests/); the redaction code it guards, and its tag, come with STEP-M1A-120 and STEP-M1A-130."
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
- [x] A static-check test fails on a `node:` import, a bare module specifier,
      or a use of `Buffer`, `process` or `require` in `src/`; the test proves
      this on bad samples.
- [x] The same check fails on console output and on use of persistent storage
      or environment variables in `src/`.
- [x] `.github/workflows/ci.yml` runs install, build, type-check and both unit
      runs on Node 24 on every push and pull request; it runs no integration
      or attended test and holds no device credentials.
- [x] One npm script runs build, type-check and both unit runs; the workflow
      calls that script.
- [x] The script passes locally.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
