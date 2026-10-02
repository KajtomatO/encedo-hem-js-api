---
id: REQ-NET-008
title: Optional minimum interval between requests
status: verified
priority: should
revision: 1
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
- [ ] The default interval is zero and adds no delay.
- [ ] With an interval of 150 ms and fake timers, consecutive requests start
      at least 150 ms apart.
- [ ] The interval also applies to retried requests.
- [ ] (M1B) whether the M1B suite needs pacing to run without a stall is
      recorded.
