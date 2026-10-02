---
id: REQ-BUILD-003
title: Only APIs present in both Node.js and browsers
status: approved
priority: must
revision: 1
source: start_point G3; ARCHITECTURE.md §1
depends_on: ["REQ-TEST-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#3-component-overview"]
---

# Only APIs present in both Node.js and browsers

Code under `src/` SHALL NOT import any module from outside `src/` nor use an
API that is absent from either Node.js 24 or the supported browsers.

**Rationale:** The same files have to run in both runtimes. Networking goes
through `fetch` and cryptography through Web Crypto; a single `node:` import
would break the browser build. Introduced in M1.

**Acceptance criteria:**
- [ ] A static check finds no `node:` import, no bare module specifier, and
      no use of `Buffer`, `process` or `require` in `src/`.
- [ ] Cryptography is done only through `globalThis.crypto`, networking only
      through `fetch`.
- [ ] The browser run of the unit suite (REQ-TEST-002) is the behavioural
      check.
