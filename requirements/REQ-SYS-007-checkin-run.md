---
id: REQ-SYS-007
title: One-call check-in
status: approved
priority: must
revision: 1
source: start_point M1.3; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-SYS-004", "REQ-SYS-005", "REQ-SYS-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# One-call check-in

The library SHALL provide a single check-in call that performs the device's
first step, the relay exchange and the device's second step, in that order.

**Rationale:** Most callers want the clock set, not three calls to sequence.
The same call is what the session engine uses for clock recovery. Introduced
in M1.

**Acceptance criteria:**
- [ ] The three legs happen in order, and each value is passed to the next
      leg unchanged.
- [ ] The result is the result of the second device step.
- [ ] A failure names the leg that failed.
- [ ] With no relay configured the call raises `HemUnsupportedError`.
- [ ] A check-in never triggers another check-in.
- [ ] (M1B) a check-in on the test device returns status `OK` and leaves the
      clock set; whether `newcrt` is reported is recorded (ARCHITECTURE.md
      §6, quirk 16).
