---
id: REQ-BUILD-002
title: No runtime dependencies
status: approved
priority: must
revision: 1
source: start_point G2
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed"]
---

# No runtime dependencies

The published package SHALL NOT declare any runtime dependency.

**Rationale:** A library that holds HSM credentials should bring no
third-party code into the consumer's process, and nothing native to compile.
Introduced in M1.

**Acceptance criteria:**
- [ ] A test asserts that `package.json` has no `dependencies`,
      `peerDependencies` or `optionalDependencies` entries.
- [ ] The package has no install scripts and no native addon.
- [ ] The build output imports nothing outside itself.
