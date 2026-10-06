---
id: STEP-M1A-020
title: Test infrastructure — fake fetch, network guard, headless-browser run
milestone: M1A
implements: ["REQ-TEST-001", "REQ-TEST-002"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout"]
depends_on: ["STEP-M1A-010"]
evidence:
  commits: ["34531a7", "827afb9"]
  tests: ["verifies: REQ-TEST-001 (tests/unit/network-guard.test.ts, tests/unit/network-guard.node.test.ts, tests/unit/fake-fetch.test.ts)", "verifies: REQ-TEST-002 (tests/unit/test-projects.node.test.ts)", "supports: REQ-TEST-001 (tests/support/fake-fetch.ts)"]
  notes: "npm test (Node v24.21.0, headless Chromium via Playwright 1.63 / Chrome for Testing 153): node project 5 files, browser project 3 files, 31 tests passed (33 after the REQ-TEST-002 config test was added); typecheck passes. The guard is proven by a separate Vitest run over fixtures (tests/fixtures/network-guard/), where both tests fail."
reopened: []
cancelled: null
---

**Goal:** One command runs the unit test files in Node 24 and in a headless
browser; a request that was not substituted fails its test; tests share one
fake `fetch` for scripting device responses.

**Notes:**
- Browser run: Vitest browser mode with Playwright Chromium as the provider.
  ARCHITECTURE.md D5 fixes Vitest and "a headless browser" but not the
  provider. It is a development dependency, and its first use downloads a
  browser binary.
- The test setup replaces the global `fetch` with one that fails the test
  (REQ-TEST-001); tests hand their own fake to the code under test.
- The fake `fetch` in `tests/support/` scripts responses per method and path
  and records every request (method, URL, headers, body) for assertions. It is
  tagged `supports: REQ-TEST-001`.
- `*.node.test.ts` files (STEP-M1A-010) are excluded from the browser project
  (user decision 2026-10-05).
- The `implements:` tags for the two REQs go in `vitest.config.ts` and the
  test setup file (REQUIREMENTS-MANAGEMENT.md §4.2, as amended 2026-10-05).
- Closed elsewhere: REQ-TEST-001 "every binding has a unit test" and
  "networking disabled" in STEP-M1A-230; REQ-TEST-002 "CI runs both" in
  STEP-M1A-030 and "the browser run includes the cryptographic tests" in
  STEP-M1A-060. Both REQs are listed in those steps too.

**Definition of done**
- [x] `vitest.config.ts` defines a Node project and a headless-browser project
      over the same `tests/unit/` files, and one npm script runs both.
- [x] The test setup replaces the global `fetch` with one that fails the test;
      a test proves that an unsubstituted request fails.
- [x] `tests/support/` holds the shared fake `fetch` (scripted responses,
      recorded requests), tagged `supports:`, with tests of its own.
- [x] `*.node.test.ts` files run only in the Node project.
- [x] Both runs pass locally, including the tests of STEP-M1A-010.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
