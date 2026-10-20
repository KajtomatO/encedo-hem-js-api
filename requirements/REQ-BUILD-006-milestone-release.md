---
id: REQ-BUILD-006
title: A versioned release at the end of each milestone
status: verified
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
- [x] The version is 0.1.0 after the M1B gate, 0.2.0 after M2B and 1.0.0
      after M3B — 0.1.0 set 2026-10-20 (STEP-M1B-150), after the gate of
      STEP-M1B-140.
- [x] The changelog entry lists the operations the release adds —
      `CHANGELOG.md`, 0.1.0 entry (2026-10-20), plus the device findings
      callers must know.
- [x] The packed archive installs into an empty Node 24 project and imports
      — `tests/unit/pack-install.node.test.ts` packs, installs offline into
      a temporary ESM project and imports `HemClient`, `HEM_API_VERSION`
      and `createNodeFetch`; the archive holds only `dist/`, `package.json`,
      `README.md`, `LICENSE` and `CHANGELOG.md`.
- [x] The package name is decided before 0.1.0 (ARCHITECTURE.md §11, risk
      12) — `@kajtomato/encedo-hem-sdk` (user decision 2026-10-20).
- [ ] Tagging and publishing are done by the user — left open on purpose:
      the tag `v0.1.0` and `npm publish` are the user's actions; the
      library never pushes or publishes.
