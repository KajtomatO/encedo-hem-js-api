---
id: STEP-M1A-140
title: Re-authentication after 401, shared login
milestone: M1A
implements: ["REQ-AUTH-008", "REQ-AUTH-013", "REQ-NET-005", "REQ-NET-008"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
depends_on: ["STEP-M1A-130"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The client survives a token that the device no longer accepts by
re-authenticating once after a 401, and concurrent calls for one scope share
a single login.

**Notes:**
- After a 401 on an authenticated call: drop the token of that scope only,
  obtain a new one, repeat the call once. A second 401 is the error. Tokens
  die when the device reboots [YAML]; this is how the client finds out
  (REQ-AUTH-008).
- Shared login (REQ-AUTH-013): one acquisition in flight per scope; every
  waiting call gets its outcome; a failed acquisition is not remembered, so
  the next call starts a new one.
- The shared acquisition is not tied to any one caller's signal: aborting
  one waiting call must not fail the others (REQ-NET-005, fourth
  criterion).
- The repeated call goes through the request queue like any other, so the
  pacing interval applies to it (REQ-NET-008, third criterion).
- Public operations are never retried through a login.
- Partly closed here: REQ-NET-005 and REQ-NET-008, one criterion each.

**Definition of done**
- [ ] A 401 followed by a 200 resolves the call; the request sequence is
      call, challenge, proof, call.
- [ ] A second 401 raises `HemUnauthenticatedError`; there is no third
      attempt.
- [ ] Only the token of the affected scope is discarded.
- [ ] Five concurrent calls for one scope on an empty cache cause one
      challenge and one proof.
- [ ] If that login fails, every waiting call is rejected with an error of
      the same class.
- [ ] The next call after a failed login starts a new one.
- [ ] Aborting one call does not fail another call that shares the same
      login.
- [ ] With a pacing interval set, the repeated request keeps the interval
      too.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
