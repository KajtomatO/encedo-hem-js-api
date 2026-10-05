---
id: STEP-M1A-200
title: Approval engine — begin, poll, wait, broker-drift recovery
milestone: M1A
implements: ["REQ-AUTH-018", "REQ-AUTH-020", "REQ-AUTH-016"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
depends_on: ["STEP-M1A-190"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** An approval attempt runs as begin, poll and wait and always ends as
approved, rejected or timed out; a broker rejection caused by clock drift is
repaired once by a check-in.

**Notes:**
- The engine goes in `src/auth/`. Begin obtains the relay key, calls
  `ext/request` and submits the result to the relay. Poll performs one check
  and, on approval, redeems the reply through `ext/token`. Wait polls every
  5 seconds until an outcome or the time limit, 60 seconds by default, with
  at least one poll (REQ-AUTH-018; defaults from [C-SDK]).
- A transport error during one poll does not end the wait; a caller's
  `AbortSignal` does.
- The wait is tested with fake timers and must also pass in the browser run.
- Drift recovery (REQ-AUTH-020, all from [C-SDK]): the submit is answered
  401, and the `iat` claim decoded from the authorization request is more
  than 2 seconds ahead of, or more than 15 seconds behind, local time. Then:
  one check-in, a new `ext/request`, a new submit — once per attempt.
- Reading `iat` is the only place where the client looks inside an otherwise
  opaque value. Take the encoding of the authorization request from [C-SDK]
  when implementing; if `iat` cannot be read, there is no drift evidence and
  the 401 is reported.
- Without a relay the engine raises `HemUnsupportedError`; the two device
  calls keep working (REQ-AUTH-016).
- Partly closed here: REQ-AUTH-016 (in-memory relay; relay set to none, for
  the engine).

**Definition of done**
- [ ] Begin obtains the relay key, calls `ext/request` and submits the result
      to the relay, in that order.
- [ ] Approved: the token is cached under the requested scope and the wait
      resolves.
- [ ] Rejected: `HemApprovalRejectedError` is raised and `ext/token` is never
      called.
- [ ] No answer within the limit, or the relay reporting the request as
      expired: `HemApprovalTimeoutError`.
- [ ] Wait polls every 5 seconds for up to 60 seconds by default, and at
      least once.
- [ ] A transport error during one poll does not end the wait; an
      `AbortSignal` cancels the wait.
- [ ] A unit test completes an approval with an in-memory relay and makes no
      request to `api.encedo.com`.
- [ ] With the relay set to none the engine raises `HemUnsupportedError`,
      while `ext/request` and `ext/token` still work.
- [ ] A submit rejected with 401 and drift evidence leads to one check-in, a
      new `ext/request` and a new submit; at most once per approval attempt.
- [ ] A submit rejected with 401 without drift evidence is reported as an
      error with zero check-in requests.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
