---
id: STEP-M1B-140
title: M1B gate — findings, open questions, trace
milestone: M1B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-080", "STEP-M1B-090", "STEP-M1B-100", "STEP-M1B-110", "STEP-M1B-120", "STEP-M1B-130"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The B gate of M1 (ARCHITECTURE.md §8) is declared: the integration
suite passes against the device, the attended checks were performed, every
`(M1B)` criterion is resolved or explicitly carried, and §11 records the
findings.

**Notes:**
- Gate chore, `implements` empty: it closes criteria and records findings
  rather than implementing a requirement.
- Checklist of what is closed here and nowhere else:
  - REQ-NET-004: the default time limit sufficed for login and every M1
    operation; the slowest observed time recorded.
  - REQ-NET-008: pacing finding from STEP-M1B-100 written into the REQ.
  - REQ-TEST-005: device record completed; the two review criteria
    (permitted operations only; protected set untouched) ticked after a
    review of every test; `(M1B)` boxes ticked.
  - REQ-TEST-006: the two review criteria ticked; "no `EHEMTEST` key
    remains" verified by a final listing.
  - §11: Q1–Q6 states updated; risks 3 (connection reuse), 4 (soft reboot
    and the clock), 8 (largest lifetime), 9 (master login → M3B), 10
    (search alignment), 11 (browser access to the relays) updated with the
    findings.
  - ARCHITECTURE.md line "Nothing in this document has been verified by
    this library against a device yet" replaced by the M1B state.
- A full `npm run test:integration` run with the pacing found in
  STEP-M1B-100 is the gate evidence; its output summary goes into
  `evidence.notes`.
- Then regenerate the trace matrix (§4.3).

**Definition of done**
- [ ] Full integration run green against the device; summary in evidence.
- [ ] Every `(M1B)` box in `requirements/` is ticked with its finding or
      carried forward by a recorded human decision.
- [ ] REQ-NET-004, REQ-NET-008, REQ-TEST-005 and REQ-TEST-006 closed as
      listed above.
- [ ] §11 updated for Q1–Q6 and risks 3, 4, 8, 9, 10, 11.
- [ ] Trace matrix regenerated; coverage report clean.
