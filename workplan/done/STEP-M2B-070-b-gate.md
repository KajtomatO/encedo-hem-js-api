---
id: STEP-M2B-070
title: B gate
milestone: M2B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M2B-060"]
evidence:
  commits: ["7d43dd3"]
  tests: []
  notes: "Gate run 2026-10-27, `npm run test:integration` (150 ms pacing): 14 files, 59 tests passed, 214.6 s, right after a cold boot (clock unset; the first login ran one check-in). The first attempt earlier that hour failed: during the P-256 signing of signatures.test.ts the device stopped answering (30 s timeouts, then EHOSTUNREACH for 192.168.7.1); the user power-cycled it; the sweep then deleted the 3 EHEMTEST keys that run had left. All (M2B) boxes of the 20 M2A REQs are ticked with findings; none carried. §11 risk 2 resolved for Node (browsers unprobed). Quirks sharpened: 2 (decaps alg = token scope), 3 (795 observed here), 4 (echo only for a known type the derive cannot produce), 9 (32 bytes for P-384 and Curve448), 11 (corrected: SECP keys need an explicit mode; raw SECP peers compressed), 15 (log format, current file locked). Final listing: no EHEMTEST key (device-policy test). User decision 2026-10-27 after the gate: keys.create and keys.import default SECP* mode to ECDH — handled as a §6.2 change with its own step before the release."
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
- [x] Full integration run green against the device; summary in evidence.
- [x] Every `(M2B)` box in `requirements/` is ticked with its finding or
      carried forward by a recorded user decision.
- [x] §6, §10 and §11 updated; no `EHEMTEST` key remains.
- [x] Trace matrix regenerated; coverage report clean.
