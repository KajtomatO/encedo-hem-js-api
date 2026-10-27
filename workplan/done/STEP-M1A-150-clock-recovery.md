---
id: STEP-M1A-150
title: Clock recovery through check-in
milestone: M1A
implements: ["REQ-AUTH-009", "REQ-SYS-007"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-110", "STEP-M1A-130"]
evidence:
  commits: ["74c6018"]
  tests: ["verifies: REQ-AUTH-009 (tests/unit/clock-recovery.test.ts)", "verifies: REQ-SYS-007 (tests/unit/clock-recovery.test.ts)"]
  notes: "npm run check: 38 files, 672 tests passed in Node v24.21.0 and headless Chromium. ClockRecovery (src/auth/recovery.ts) is the reusable 'recover once through check-in' part, with showsDrift() for the drift test; STEP-M1A-190/200 reuse it. New client option clockRecovery (default true). Check-in uses only public operations, so it can never reach a login and trigger another check-in."
reopened: []
cancelled: null
---

**Goal:** A login that fails because the device clock is unset or has drifted
is repaired by one check-in and one repeated login, and a plain wrong
passphrase never causes cloud traffic.

**Notes:**
- Triggers, from REQ-AUTH-009: the challenge request is answered with 403
  (clock not set) [YAML]; or the proof is answered with 401 while the
  challenge shows drift — the challenge `exp` minus 60 seconds differs from
  local time by more than 60 seconds [C-SDK].
- The recovery uses the one-call check-in of STEP-M1A-110 and then a fresh
  challenge. At most one recovery check-in per token acquisition.
- Recovery can be switched off by an option and is unavailable when no
  check-in relay is configured; in both cases the original error is
  reported.
- When the check-in itself fails, the login error is reported with the
  check-in failure attached as its cause.
- Build the "recover once through check-in" part so it can be reused:
  STEP-M1A-190 applies it to `ext/request` (REQ-AUTH-014) and STEP-M1A-200
  to the broker's drift rejection (REQ-AUTH-020).
- Unit tests substitute the relay; nothing reaches `api.encedo.com`.
- Partly closed here: REQ-SYS-007 (a check-in never triggers another
  check-in), which can only be shown once recovery exists.

**Definition of done**
- [x] A 403 on the challenge leads to one check-in and a repeated login that
      succeeds.
- [x] A 401 on the proof with drift evidence does the same, using a fresh
      challenge.
- [x] A 401 on the proof without drift evidence raises
      `HemUnauthenticatedError` with zero check-in requests.
- [x] At most one recovery check-in happens per token acquisition; a second
      failure is reported.
- [x] With recovery switched off, or with no check-in relay configured, the
      original error is reported and no check-in is attempted.
- [x] If the check-in itself fails, the login error is reported with the
      check-in failure attached as its cause.
- [x] A check-in never triggers another check-in.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
