---
id: STEP-M1B-000
title: Placeholder for M1B — MVP hardware verification
milestone: M1B
implements: ["REQ-TEST-003", "REQ-TEST-004", "REQ-BUILD-006"]
traces:
  architecture: ["ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1A-230"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: "Replaced by STEP-M1B-010…150 at the M1B decomposition (2026-10-06)"
---

**Goal:** Stand-in for the detailed M1B steps: everything in the M1B entry of
ARCHITECTURE.md §10, ending in the B gate and version 0.1.0.

**Notes:**
- Coarse placeholder created at the first decomposition
  (REQUIREMENTS-MANAGEMENT.md §5.3 step 5). It is never implemented: when
  M1B is decomposed it is cancelled and replaced by detailed steps.
- M1B is decomposed only after the M1A gate has passed (§5.5).
- M1B opens with two reviews before any step runs: the test device and its
  test policy (ARCHITECTURE.md D10), and the exclusion of Argon2 (D6; §11
  risk 14).
- M1B also settles the `(M1B)` acceptance criteria of the M1A REQs. Those
  REQs are not listed in `implements`, so that they can reach `implemented`
  and `verified` in the A part (§5.5).

**Definition of done**
- [x] Cancelled and replaced by the detailed M1B steps.
