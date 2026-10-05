---
id: STEP-M1A-200
title: Approval engine — begin, poll, wait, broker-drift recovery
milestone: M1A
implements: ["REQ-AUTH-018", "REQ-AUTH-020", "REQ-AUTH-016"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
depends_on: ["STEP-M1A-190"]
evidence:
  commits: ["68b94b7"]
  tests: ["verifies: REQ-AUTH-018 (tests/unit/approval-engine.test.ts)", "verifies: REQ-AUTH-020 (tests/unit/approval-engine.test.ts)", "verifies: REQ-AUTH-016 (tests/unit/approval-engine.test.ts)", "supports: REQ-TEST-002 (tests/support/timers.ts)"]
  notes: "npm run check (twice): 47 files, 962 tests passed in Node v24.21.0 and headless Chromium. Engine in src/auth/approval.ts; public as client.auth.beginApproval / pollApproval / waitForApproval / approve. The authreq encoding was checked in https://github.com/KajtomatO/encedo-hem-c-api (2026-10-05): a compact JWT whose base64url payload carries iat; gates +2 s ahead / 15 s behind local time; on drift its recovery repeats the whole push (session key, ext/request, submit), and so does this engine. Transient poll failures (unreachable, timeout, relay unreachable or 5xx) do not end a wait; other errors do. Also fixed here: pacing loops until the full interval has passed by the wall clock, because a Node timer fired 1 ms early under load (39 ms gap for a 40 ms interval). REQ-AUTH-016 'relay set to none' closes in STEP-M1A-210, with mobile mode."
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
- [x] Begin obtains the relay key, calls `ext/request` and submits the result
      to the relay, in that order.
- [x] Approved: the token is cached under the requested scope and the wait
      resolves.
- [x] Rejected: `HemApprovalRejectedError` is raised and `ext/token` is never
      called.
- [x] No answer within the limit, or the relay reporting the request as
      expired: `HemApprovalTimeoutError`.
- [x] Wait polls every 5 seconds for up to 60 seconds by default, and at
      least once.
- [x] A transport error during one poll does not end the wait; an
      `AbortSignal` cancels the wait.
- [x] A unit test completes an approval with an in-memory relay and makes no
      request to `api.encedo.com`.
- [x] With the relay set to none the engine raises `HemUnsupportedError`,
      while `ext/request` and `ext/token` still work.
- [x] A submit rejected with 401 and drift evidence leads to one check-in, a
      new `ext/request` and a new submit; at most once per approval attempt.
- [x] A submit rejected with 401 without drift evidence is reported as an
      error with zero check-in requests.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
