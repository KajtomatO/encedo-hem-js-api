---
id: STEP-M1B-090
title: Attended — reboot, power cycle, unplugged device
milestone: M1B
implements: ["REQ-AUTH-008", "REQ-AUTH-009", "REQ-SYS-003", "REQ-NET-006"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-080"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The client keeps working across a reboot and a cold boot with no
action by the caller; an unplugged device is reported as unreachable within
the time limit. Resolves §11 risk 4.

**Notes:**
- Attended test under `tests/attended/`, gated by `EHEM_ALLOW_DISRUPTIVE=1`,
  with the user at the device. It prints each instruction and waits for
  Enter on stdin. State the whole sequence and stop before starting.
- The soft reboot is triggered by the user with the C client's reboot
  command, never by this library (reboot is M3A; D14).
- Sequence:
  1. log in and cache a token; "reboot the device now" → the next call
     succeeds with exactly one re-login (REQ-AUTH-008); `status` afterwards
     shows whether a soft reboot cleared the clock (REQ-AUTH-009; risk 4);
  2. "unplug and replug the device" → the next call succeeds through an
     automatic check-in (REQ-AUTH-009) — a cold boot clears the clock, the
     challenge answers 403, recovery runs one check-in;
  3. "unplug the device" → `health()` reports unreachable within the time
     limit (REQ-SYS-003) and `status()` raises `HemUnreachableError`; Node's
     `fetch` error for a powered-off device recorded (REQ-NET-006);
  4. "plug the device back in".
- Record every wall-clock time (feeds REQ-NET-004 at the gate).

**Definition of done**
- [ ] After a reboot the next call succeeds unaided (REQ-AUTH-008).
- [ ] After a power cycle a call succeeds through an automatic check-in;
      whether a soft reboot clears the clock is recorded (REQ-AUTH-009).
- [ ] Unplugged: `health()` reports unreachable within the limit
      (REQ-SYS-003); the powered-off `fetch` error recorded (REQ-NET-006).
- [ ] The attended test prints each action before it, skips without the
      opt-in, and is tagged `verifies:`; findings next to the boxes.
