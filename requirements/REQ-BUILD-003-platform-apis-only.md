---
id: REQ-BUILD-003
title: Only APIs present in both Node.js and browsers
status: needs-reverify
priority: must
revision: 5
source: start_point G3; ARCHITECTURE.md §1; user decision 2026-10-07 (Node transport exception, REQ-NET-013)
depends_on: ["REQ-TEST-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#3-component-overview"]
---

# Only APIs present in both Node.js and browsers

Code under `src/` SHALL NOT import any module from outside `src/` nor use an
API that is absent from either Node.js 24 or the supported browsers, except
that `src/transport/node-https.ts` imports `node:https` and `node:http`
dynamically and reads `process` to detect Node.js, and is never executed in
a browser.

**Rationale:** The same files have to run in both runtimes. Networking goes
through `fetch` and cryptography through Web Crypto; a `node:` import would
break the browser build. Amended 2026-10-07 (user decision, REQ-NET-013):
firmware 1.2.2 cannot be driven through Node's `fetch` (ARCHITECTURE.md §6
quirk 18), so the Node.js device transport is the one file that uses a
`node:` module, behind a dynamic import that a browser never executes.
Introduced in M1.

**Acceptance criteria:**
- [x] A static check finds no `node:` import, no bare module specifier, and
      no use of `Buffer`, `process` or `require` in `src/` — the only
      exceptions being the dynamic `node:https`/`node:http` import and
      `process` in `src/transport/node-https.ts`.
- [x] Cryptography is done only through `globalThis.crypto`, networking only
      through `fetch` or, on Node.js, the transport of REQ-NET-013.
- [x] The browser run of the unit suite (REQ-TEST-002) is the behavioural
      check, and it loads nothing from `node:`.
