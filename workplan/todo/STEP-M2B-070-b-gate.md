---
id: STEP-M2B-070
title: B gate
milestone: M2B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2B-060"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The B gate of M2 (ARCHITECTURE.md §8) is declared: the whole integration suite passes against the device, every `(M2B)` criterion is resolved or explicitly carried, and §10 and §11 record the findings.

**Notes:**
- Gate chore, `implements` empty: it closes criteria and records findings.
- One full `npm run test:integration` (M1 and M2 files) is the gate
  evidence; its summary goes into `evidence.notes`.
- §11: risk 2 (ML-DSA status) closed from STEP-M2B-050; any new quirk from
  the M2B runs added to the §6 table.
- §10: the M2B entry gets its "Passed" note.
- A final key listing confirms no `EHEMTEST` key remains.
- Then regenerate the trace matrix (§4.3).

**Definition of done**
- [ ] Full integration run green against the device; summary in evidence.
- [ ] Every `(M2B)` box in `requirements/` is ticked with its finding or
      carried forward by a recorded user decision.
- [ ] §6, §10 and §11 updated; no `EHEMTEST` key remains.
- [ ] Trace matrix regenerated; coverage report clean.
