---
id: STEP-M1A-170
title: Approval engine, mobile login mode, broker drift recovery
milestone: M1A
implements: ["REQ-AUTH-018", "REQ-AUTH-019", "REQ-AUTH-020"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#52-session-behaviour"]
depends_on: ["STEP-M1A-160"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Begin, poll and wait end every approval attempt as approved
(token cached), `HemApprovalRejectedError` or `HemApprovalTimeoutError`; a
client configured for mobile approval obtains every token through this
engine; a broker 401 with drift evidence triggers one check-in and a fresh
request.

**Notes:** Begin: obtain the relay key, call ext/request, submit to the
relay. Poll: one check; on approval redeem through ext/token. Wait: poll
every 5 s, up to 60 s by default, at least one poll; a transport error in
one poll does not end the wait; an `AbortSignal` cancels it. Mobile mode is
exclusive with a passphrase. A 401 on a token obtained this way leads to
one new approval and one retry, through the engine of STEP-M1A-100. Drift
evidence: broker 401 and the `iat` decoded from the authorization request
more than 2 s ahead of or 15 s behind local time; at most once per attempt.
Fake timers throughout.

**Definition of done**
- [ ] Approved: the token is cached under the requested scope and the wait resolves
- [ ] Rejected: `HemApprovalRejectedError` is raised and ext/token is never called
- [ ] No answer within the limit, or the relay reporting the request as expired: `HemApprovalTimeoutError`
- [ ] A transport error during one poll does not end the wait; an `AbortSignal` cancels the wait
- [ ] With the relay set to none, the engine and mobile login mode raise `HemUnsupportedError`
- [ ] Mobile-mode client: the first authenticated call triggers one approval for its scope and proceeds; further calls for that scope cause no new approval; passphrase and mobile mode together are rejected; a 401 leads to one new approval and one repeated call
- [ ] A broker 401 with drift evidence leads to one check-in, a new ext/request and a new submit; without evidence the error is reported with zero check-in requests; this happens at most once per attempt
