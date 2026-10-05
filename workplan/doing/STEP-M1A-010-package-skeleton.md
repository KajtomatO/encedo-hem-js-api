---
id: STEP-M1A-010
title: Package skeleton, build and Node test run
milestone: M1A
implements: ["REQ-BUILD-001", "REQ-BUILD-002", "REQ-BUILD-004", "REQ-API-010"]
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#9-directory-layout"]
depends_on: []
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `npm install`, `npm run build` and `npm test` work on Node 24: `tsc`
emits ESM JavaScript and type declarations into `dist/`, the package root
exports the targeted API version, and tests guard the packaging rules.

**Notes:**
- Toolchain per ARCHITECTURE.md D5: npm, `tsc`, Vitest — development-only.
- `src/index.ts` starts with the API-version constant only (REQ-API-010);
  later steps add exports.
- Tests that need the filesystem or the build output (package metadata, pack
  contents, import of the built package) cannot run in a browser. They live
  in `tests/unit/` as `*.node.test.ts` and are skipped by the browser run that
  STEP-M1A-020 adds (user decision 2026-10-05).
- `package.json` cannot carry comments. The `implements:` tags of the BUILD
  REQs go where comments are possible (`tsconfig.json`) or into a `"//"`
  member of `package.json`; REQUIREMENTS-MANAGEMENT.md §4.2 allows both
  locations.
- Partly closed here: REQ-BUILD-004 also has criteria closed by STEP-M1A-030
  (CI on Node 24) and STEP-M1A-220 (README); REQ-API-010 has one closed by
  STEP-M1A-220 (README).
- ARCHITECTURE.md §11 risk 13 (Node 24 not installed) no longer holds on the
  development machine: `node --version` reported v24.21.0 on 2026-10-05. The
  risk text is left as it is until the user says to update it.

**Definition of done**
- [ ] `package.json` declares `"type": "module"`, an `exports` map with types
      and `engines.node` `>=24`; it has no `dependencies`, `peerDependencies`
      or `optionalDependencies`, no install scripts, and there is no CommonJS
      output.
- [ ] `tsconfig.json` enables strict type-checking; the build command emits
      `.js` and `.d.ts` files into `dist/`; the type-check command passes.
- [ ] `src/index.ts` exports the targeted API version `1.2.2` as a constant,
      and a unit test checks its value.
- [ ] A Node-only test asserts the dependency and install-script rules of
      REQ-BUILD-002 and that the build output imports nothing outside itself.
- [ ] A Node-only smoke test imports the built package from a plain ESM file.
- [ ] A Node-only test checks that the packed archive contains only the build
      output, README, LICENSE and `package.json`.
- [ ] `npm test` runs Vitest in Node 24 and passes.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
