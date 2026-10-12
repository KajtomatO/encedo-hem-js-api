---
id: STEP-M1B-100
title: Attended — parallel-request and pacing probe
milestone: M1B
implements: ["REQ-NET-007", "REQ-NET-008"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-090"]
evidence:
  commits: ["b7b23f5"]
  tests: ["verifies: REQ-NET-007, REQ-NET-008 (tests/attended/parallel.test.ts, attended 2026-10-12; unpaced integration run)"]
  notes: "Attended 2026-10-12, user standing by; no stall. Two parallel status requests ×5: both ~400 ms each round; four at once ×2: two ~400 ms, two ~1 450 ms (about one TCP connect retry later, suggesting two connection slots); two logged-in clients listing at once ×3: all ok. Full integration suite unpaced: 30/30 in 109.8 s (paced 150 ms: 104.6 s). The integration command keeps its 150 ms default as a precaution (stall observed 2026-10-07 after ~40 rapid probes; [C-SDK] records stalls under sustained load). Q5 recorded in ARCHITECTURE.md §11."
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
- [x] Parallel-request outcome recorded (REQ-NET-007).
- [x] Pacing need recorded; the integration command's default follows it
      (REQ-NET-008).
- [x] The attended test prints its action, skips without the opt-in, and is
      tagged `verifies:`; findings next to the boxes.
