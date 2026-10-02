---
id: REQ-AUTH-009
title: Login recovery when the device clock is wrong
status: approved
priority: must
revision: 1
source: ARCHITECTURE.md §5; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-001", "REQ-SYS-007"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Login recovery when the device clock is wrong

When a login fails because the device clock is unset or has drifted, the
session SHALL run one check-in and repeat the login once.

The two triggers:

- the challenge request is answered with 403 (clock not set) [YAML];
- the proof is answered with 401 while the challenge shows drift, that
  is, the challenge `exp` minus 60 seconds differs from the local time
  by more than 60 seconds [C-SDK].

**Rationale:** The clock is unset after a cold boot and runs about 8% fast,
so a correct passphrase is eventually rejected; check-in is the only thing
that sets the clock [YAML], [C-SDK]. Without this recovery an unattended
consumer stops working after a power cut. The drift test keeps a plain wrong
passphrase from triggering cloud traffic. Introduced in M1.

**Acceptance criteria:**
- [ ] A 403 on the challenge leads to one check-in and a repeated login that
      succeeds.
- [ ] A 401 on the proof with drift evidence does the same, using a fresh
      challenge.
- [ ] A 401 on the proof without drift evidence raises
      `HemUnauthenticatedError` with zero check-in requests.
- [ ] At most one recovery check-in happens per token acquisition; a second
      failure is reported.
- [ ] With recovery switched off, or with no check-in relay configured, the
      original error is reported and no check-in is attempted.
- [ ] If the check-in itself fails, the login error is reported with the
      check-in failure attached as its cause.
- [ ] (M1B) attended: after a power cycle a call succeeds through an
      automatic check-in.
- [ ] (M1B) whether a soft reboot clears the clock is recorded
      (ARCHITECTURE.md §11, risk 4).
