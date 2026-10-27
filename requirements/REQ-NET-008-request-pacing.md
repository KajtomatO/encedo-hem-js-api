---
id: REQ-NET-008
title: Optional minimum interval between requests
status: verified
priority: should
revision: 5
source: ARCHITECTURE.md §7; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-NET-007"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Optional minimum interval between requests

The client SHOULD support a configurable minimum interval between the starts
of consecutive device requests.

**Rationale:** The C client's test suite needed 150 ms between requests to
keep the device alive through a full run [C-SDK]. A consumer with bursty
load may need the same knob. Introduced in M1.

**Acceptance criteria:**
- [x] The default interval is zero and adds no delay.
- [x] With an interval of 150 ms and fake timers, consecutive requests start
      at least 150 ms apart.
- [x] The interval also applies to retried requests.
- [x] (M1B) whether the M1B suite needs pacing to run without a stall is
      recorded — 2026-10-12: not needed. The full integration suite passed
      30/30 without pacing in 109.8 s, against 104.6 s with 150 ms pacing
      (2026-10-09); no stall either way. The integration command keeps its
      150 ms default anyway: the device stalled once on 2026-10-07 after
      ~40 rapid unpaced probes, and [C-SDK] records stalls under longer
      sustained load; the cost is negligible.
