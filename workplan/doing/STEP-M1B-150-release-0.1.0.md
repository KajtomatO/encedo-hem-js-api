---
id: STEP-M1B-150
title: Release 0.1.0
milestone: M1B
implements: ["REQ-BUILD-006"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-140"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Version 0.1.0 is recorded in `package.json` and a changelog entry
lists the operations it adds; the packed archive installs into an empty
Node 24 project and imports. Tagging and publishing are the user's.

**Notes:**
- Package name (§11 risk 12): undecided — ask the user at the start of this
  step; the name goes into `package.json` and the README install line.
- `CHANGELOG.md`: the M1 operations — login, mobile approval, status,
  version, health, check-in, key create/get/search/list/delete, HMAC,
  wrap, unwrap — and the M1B findings callers must know (token lifetimes,
  pacing, browser origin).
- Pack-and-install check: a Node-only unit test runs `npm pack`, installs
  the archive into a temporary project with `"type": "module"` and imports
  `HemClient` and `HEM_API_VERSION`. No such test exists yet.
- Never push (CLAUDE.md); the tag and `npm publish` are done by the user.

**Definition of done**
- [ ] Package name decided by the user and set.
- [ ] `package.json` version is 0.1.0; `CHANGELOG.md` has the 0.1.0 entry
      listing the operations.
- [ ] The pack-and-install test passes in Node 24.
- [ ] README install and usage lines match the package name and version.
- [ ] `implements:` and `verifies:` tags exist for REQ-BUILD-006; its boxes
      except "tagging and publishing" are ticked; that one is left to the
      user with a note.
