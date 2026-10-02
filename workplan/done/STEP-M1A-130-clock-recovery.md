---
id: STEP-M1A-130
title: Clock recovery on login
milestone: M1A
implements: ["REQ-AUTH-009"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-100", "STEP-M1A-120"]
evidence:
  commits: ["412f2ce"]
  tests: ["verifies: REQ-AUTH-009"]
  notes: "npm run check: 347 passed in Node 24 and headless Chromium. Triggers: 403 on GET /api/auth/token, or 401 on the proof while |challenge.exp - 60 - local time| > 60 s. One recovery per token acquisition (loginWithClockRecovery); the check-in is the one-call check-in, which involves no login and so cannot recurse. Session.recoverClock is reused by ext/request in STEP-M1A-160. A failing check-in becomes the cause of the original login error. Option: clockRecovery (default true)."
reopened: []
cancelled: null
---

**Goal:** When a login fails because the device clock is unset (403 on the
challenge) or has drifted (401 on the proof while the challenge `exp` minus
60 s differs from local time by more than 60 s), the engine runs one
check-in and repeats the login once.

**Notes:** At most one recovery per token acquisition. A 401 without drift
evidence is a wrong passphrase and never triggers a check-in. Recovery can
be switched off by option and is unavailable without a check-in relay; then
the original error is reported. A failing check-in is attached as `cause`
to the login error. The check-in used is the one-call check-in of
STEP-M1A-120, which never recurses into recovery.

**Definition of done**
- [x] A 403 on the challenge leads to one check-in and a repeated login that succeeds
- [x] A 401 on the proof with drift evidence leads to one check-in, a fresh challenge and a login that succeeds
- [x] A 401 on the proof without drift evidence raises `HemUnauthenticatedError` with zero check-in requests
- [x] At most one recovery check-in happens per token acquisition; a second failure is reported
- [x] With recovery switched off, or with no check-in relay configured, the original error is reported and no check-in is attempted
- [x] If the check-in fails, the login error is reported with the check-in failure as its `cause`
