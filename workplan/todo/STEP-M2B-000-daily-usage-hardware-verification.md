---
id: STEP-M2B-000
title: M2B placeholder — daily usage and audit logs, hardware verification
milestone: M2B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M2A-000"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Placeholder for M2B (ARCHITECTURE.md §10). It is cancelled and
replaced by detailed steps when M2B is decomposed, after the M2A gate.

**Notes:** `implements` is empty because a B part introduces no new REQs;
it settles the `(M2B)` criteria of the M2A REQs on the device, including
the firmware-quirk probes (ML-DSA verify status through `fetch`, ML-KEM
`alg`, derive echo). Release 0.2.0 after the B gate.

**Definition of done**
- [ ] Not applicable: this placeholder is cancelled when M2B is decomposed
