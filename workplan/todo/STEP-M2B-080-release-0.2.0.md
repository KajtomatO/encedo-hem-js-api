---
id: STEP-M2B-080
title: Release 0.2.0
milestone: M2B
implements: ["REQ-BUILD-006", "REQ-BUILD-007"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#10-milestones"]
depends_on: ["STEP-M2B-075"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Version 0.2.0 is recorded in `package.json` and the changelog; the packed archive installs; the user pushes the tag and the release workflow publishes 0.2.0 and creates its GitHub Release.

**Notes:**
- `package.json` version 0.2.0; `CHANGELOG.md`: the Unreleased section
  becomes `## 0.2.0 — <date>` and gains the device findings callers must
  know from the M2B runs; README status line updated; the pack-and-install
  test and `npm run check` pass.
- Then the user's part, in this order: configure the trusted publisher on
  npmjs.com (owner `KajtomatO`, repository `encedo-hem-js-api`, workflow
  `release.yml`) if not yet done; merge or push `development` as they see
  fit; push the tag `v0.2.0`. The workflow's first live run publishes and
  creates the release (REQ-BUILD-007 `(M2B)` box). The step records the
  outcome the user reports (or the workflow log) in its evidence.
- Never push (CLAUDE.md).

**Definition of done**
- [ ] `package.json` is 0.2.0; the changelog entry is dated and lists the
      M2 operations and device findings; README status updated.
- [ ] Pack-and-install test and `npm run check` pass.
- [ ] REQ-BUILD-006: the 0.2.0 criterion noted; REQ-BUILD-007 `(M2B)` box
      ticked with the workflow's result, or the failure recorded and a
      fix step proposed.
