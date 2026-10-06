---
id: STEP-M1B-100
title: Attended — parallel-request and pacing probe
milestone: M1B
implements: ["REQ-NET-007", "REQ-NET-008"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-090"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Whether the device handles two parallel requests, and whether the
M1B suite needs pacing to run without a stall, are recorded (Q5; §11 risks 3
and 6).

**Notes:**
- Attended under `tests/attended/`: the probe may stall the device, which
  then needs a power cycle [C-SDK]; the user is at the device. State and
  stop before starting.
- Parallel probe: the library serialises, so the test bypasses it — two
  `status` requests at once through two clients (or raw `fetch`). Record
  the outcome: both answered, one refused, stall.
- Pacing probe: run the integration suite once with `EHEM_TEST_PACE_MS=0`
  and once with 150; record stalls and total time (REQ-NET-008). The
  integration command's default pacing is set from this finding.
- Findings go to REQ-NET-007/008 now and to §11 Q5, risks 3 and 6 at the
  gate (STEP-M1B-140).

**Definition of done**
- [ ] Parallel-request outcome recorded (REQ-NET-007).
- [ ] Pacing need recorded; the integration command's default follows it
      (REQ-NET-008).
- [ ] The attended test prints its action, skips without the opt-in, and is
      tagged `verifies:`; findings next to the boxes.
