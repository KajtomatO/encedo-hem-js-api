---
id: STEP-M3B-000
title: Placeholder for M3B — full specification, hardware verification
milestone: M3B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M3A-000"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Stand-in for the detailed M3B steps: everything in the M3B entry of
ARCHITECTURE.md §10, ending in the B gate and version 1.0.0.

**Notes:**
- Coarse placeholder created at the first decomposition
  (REQUIREMENTS-MANAGEMENT.md §5.3 step 5). It is never implemented: when
  M3B is decomposed it is cancelled and replaced by detailed steps.
- M3B is decomposed only after the M3A gate has passed (§5.5).
- `implements` is empty because M3B has no REQs of its own: it settles the
  `(M3B)` acceptance criteria of the M3A REQs, which stay assigned to M3A
  so that they can reach `implemented` and `verified` in the A part (§5.5).
- Which destructive operations are exercised on hardware, and on which
  device, is chosen by the user when M3B is decomposed; each is attended
  and individually triggered (ARCHITECTURE.md §10, D14).

**Definition of done**
- [ ] Cancelled and replaced by the detailed M3B steps.
