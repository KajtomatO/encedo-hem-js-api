---
id: STEP-M1A-080
title: Transport — time limit, cancellation, failure classes
milestone: M1A
implements: ["REQ-NET-004", "REQ-NET-005", "REQ-NET-006"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
depends_on: ["STEP-M1A-070"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Every request ends within its time limit or on the caller's abort,
and a failure without an HTTP response is reported as exactly one of: timed
out, aborted by the caller, device unreachable.

**Notes:**
- The default limit is 30 000 ms, settable per client and per call
  (`{ signal, timeoutMs }`, ARCHITECTURE.md §4).
- The limit also covers reading the response body, so the body is read
  inside the transport before the timer is cleared.
- One internal abort controller is given to `fetch`; the timer or the
  caller's signal fires it, and whichever fired first decides the error
  class.
- A rejected `fetch` becomes `HemUnreachableError` with the original error
  as its `cause`.
- The timer tests use fake timers and must also pass in the browser run.
- Closed elsewhere: REQ-NET-004 "limit per request when a login comes
  first" in STEP-M1A-130; REQ-NET-005 "abort while queued" in STEP-M1A-090
  and "abort of one call that shares a login" in STEP-M1A-140. The REQs are
  listed in those steps too.

**Definition of done**
- [ ] The default limit is 30 000 ms; a per-client value and a per-call value
      override it.
- [ ] With a `fetch` that never settles and fake timers, the call rejects
      with `HemTimeoutError` at the limit and the signal given to `fetch` is
      aborted.
- [ ] A response whose body never finishes arriving also ends in
      `HemTimeoutError`.
- [ ] Aborting during the request rejects with `HemAbortError` and aborts the
      signal given to `fetch`.
- [ ] A signal that is already aborted rejects the call without calling
      `fetch`.
- [ ] A rejected `fetch` raises `HemUnreachableError` with the original error
      attached as its cause.
- [ ] When the time limit and a caller abort race, the one that fired first
      decides the error.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
