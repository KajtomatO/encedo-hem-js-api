---
id: STEP-M1A-010
title: Package skeleton and test toolchain
milestone: M1A
implements: ["REQ-BUILD-001", "REQ-BUILD-002", "REQ-BUILD-004", "REQ-TEST-001", "REQ-TEST-002"]
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout"]
depends_on: []
evidence:
  commits: ["ded3af3", "146b9d1", "01b0156"]
  tests: ["verifies: REQ-BUILD-001", "verifies: REQ-BUILD-002", "verifies: REQ-BUILD-004", "verifies: REQ-TEST-001", "verifies: REQ-TEST-002"]
  notes: "npm test: 11 tests passed in Node 24.21.0 and headless Chromium (CHROMIUM_PATH set to the preinstalled browser). The same run passed inside a network namespace with only loopback up (unshare -rn), i.e. with networking disabled. Node 24 was installed for this run, which closes ARCHITECTURE.md §11 risk 13 for this environment."
reopened: []
cancelled: null
---

**Goal:** An installable, buildable, testable package with no library code
yet: the build emits ESM and `.d.ts`, strict type-checking passes, and an
empty unit suite runs in Node 24 and in a headless browser from one command.

**Notes:** Toolchain per D5: npm, `tsc`, Vitest with a headless-browser
provider; all development-only. `package.json`: `"type": "module"`, an
`exports` map with types, `engines.node` `>=24`, `files` limited to the
build output, README and LICENSE; no `dependencies`, `peerDependencies` or
`optionalDependencies`, no install scripts. `tests/support/` holds the
shared fake `fetch` (tagged `supports: REQ-TEST-001`) and a setup file that
replaces the global `fetch` with one that fails the test. `src/index.ts`
starts empty. Node 24 is not installed on the development machine
(ARCHITECTURE.md §11, risk 13); this step cannot complete until it is.

**Definition of done**
- [x] The build emits ESM `.js` and `.d.ts` files only; there is no CommonJS output
- [x] `package.json` declares `"type": "module"`, an `exports` map with types and `engines.node` `>=24`; a unit test asserts there are no runtime, peer or optional dependencies and no install scripts
- [x] Strict type-checking passes
- [x] A smoke test imports the built package from a plain ESM file in Node 24
- [x] A dry-run pack lists only the build output, README, LICENSE and `package.json`
- [x] One command runs the same test files in Node 24 and in a headless browser
- [x] The test setup replaces the global `fetch` with one that fails the test; the shared fake-`fetch` module lives in `tests/support/` tagged `supports: REQ-TEST-001`
- [x] The suite passes on a machine with networking disabled
