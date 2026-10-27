---
id: STEP-M2A-090
title: Docs, surface snapshot, conformance tables, 0.2.0 changelog draft, A gate
milestone: M2A
implements: ["REQ-API-007", "REQ-API-008"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M2A-010", "STEP-M2A-020", "STEP-M2A-030", "STEP-M2A-040", "STEP-M2A-050", "STEP-M2A-060", "STEP-M2A-070"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Every M2 operation is documented, in the surface snapshot and in the conformance tables; README and an unreleased 0.2.0 changelog section describe M2; the A gate passes.

**Notes:**
- Operation-docs check covers `client.logger` and every new call (scope,
  milestone, mass-storage note where flagged); README gains the M2
  operations and the agreed-key mode; `CHANGELOG.md` gets an
  `## Unreleased (0.2.0)` section — the version bump and release are M2B
  (REQ-BUILD-006).
- REQ-API-008: the snapshot diff against the 0.1.0 entries is additive
  only; review it entry by entry.
- Conformance tests walk `ALL_OPERATIONS`: every M2 operation appears in
  the scope, TLS and no-bearer tables.
- A gate (ARCHITECTURE.md §8): `npm run check` in Node 24 and Chromium;
  every M2A REQ has `implements:` and `verifies:` tags; coverage check
  clean. If STEP-M2A-080 is still waiting for REQ-BUILD-007, the gate
  passes without it and says so.
- Report the gate in chat; M2B is decomposed only after it.

**Definition of done**
- [ ] Operation-docs test passes for every M2 operation; README and
      CHANGELOG updated.
- [ ] Surface snapshot diff is additive only; conformance tables complete.
- [ ] `npm run check` passes in Node 24 and Chromium; the coverage check
      reports no unimplemented or unverified M2A REQ and no orphan tag.
- [ ] Gate result reported to the user.
