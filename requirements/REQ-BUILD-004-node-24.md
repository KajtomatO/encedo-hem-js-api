---
id: REQ-BUILD-004
title: Node.js 24 as the minimum version
status: verified
priority: must
revision: 1
source: user decision 2026-10-02; start_point G3
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed"]
---

# Node.js 24 as the minimum version

The package SHALL declare Node.js 24 as its minimum supported Node.js
version.

**Rationale:** The first consumer runs Node 24, and one supported version
keeps the A parts' test matrix small. Introduced in M1.

**Acceptance criteria:**
- [ ] `package.json` declares `engines.node` as `>=24`.
- [ ] CI runs on Node 24.
- [ ] The README states the Node requirement and the browser requirement
      (Web Crypto with X25519).
