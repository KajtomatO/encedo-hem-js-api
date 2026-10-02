---
id: STEP-M1A-130
title: Clock recovery on login
milestone: M1A
implements: ["REQ-AUTH-009"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-100", "STEP-M1A-120"]
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] A 403 on the challenge leads to one check-in and a repeated login that succeeds
- [ ] A 401 on the proof with drift evidence leads to one check-in, a fresh challenge and a login that succeeds
- [ ] A 401 on the proof without drift evidence raises `HemUnauthenticatedError` with zero check-in requests
- [ ] At most one recovery check-in happens per token acquisition; a second failure is reported
- [ ] With recovery switched off, or with no check-in relay configured, the original error is reported and no check-in is attempted
- [ ] If the check-in fails, the login error is reported with the check-in failure as its `cause`
