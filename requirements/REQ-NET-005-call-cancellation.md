---
id: REQ-NET-005
title: Cancellation of every call
status: approved
priority: must
revision: 1
source: start_point G7
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Cancellation of every call

Every call SHALL accept an `AbortSignal` and reject with an abort error when
it fires before the call completes.

**Rationale:** A server shutting down, or a user leaving a page, needs to
stop in-flight work. `AbortSignal` is the mechanism both runtimes share.
Introduced in M1.

**Acceptance criteria:**
- [ ] Aborting during the request rejects with `HemAbortError` and aborts
      the signal given to `fetch`.
- [ ] A signal that is already aborted rejects the call without calling
      `fetch`.
- [ ] Aborting a call that is still waiting in the request queue removes it;
      it is never sent.
- [ ] Aborting one call does not fail another call that shares the same
      login.
