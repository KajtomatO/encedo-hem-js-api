---
id: STEP-M2A-090
title: Docs, surface snapshot, conformance tables, 0.2.0 changelog draft, A gate
milestone: M2A
implements: ["REQ-API-007", "REQ-API-008"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M2A-010", "STEP-M2A-020", "STEP-M2A-030", "STEP-M2A-040", "STEP-M2A-050", "STEP-M2A-060", "STEP-M2A-070"]
evidence:
  commits: ["af1da56"]
  tests: ["verifies: REQ-API-007 (tests/unit/operation-docs.node.test.ts, tests/unit/doc-check.test.ts)", "verifies: REQ-API-008 (tests/unit/surface.node.test.ts, tests/unit/surface.test.ts)"]
  notes: "A gate 2026-10-27: npm run check — build, type-check, 98 files / 2097 tests passed in Node v24.21.0 and headless Chromium (1329 at the M1B release). Surface snapshot against tag v0.1.0: 0 entries removed or changed, 159 added. Operation-docs test covers the five namespaces (system, keys, crypto, auth, logger), 45 operation descriptions, scope and milestone on every public operation and the mass-storage note on the three flagged ones; the conformance tables hold every operation description. Coverage check: 122 REQs (1 draft, 29 approved, 92 verified); every M2A REQ verified; no orphan tag, no unverified implemented REQ. README: status line and a 'Daily usage' section; CHANGELOG: 'Unreleased — 0.2.0'; ARCHITECTURE.md §10: M2A gate recorded. STEP-M2A-080 (release workflow) is not part of the gate: REQ-BUILD-007 is still a draft. The version bump and the release are M2B."
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
- [x] Operation-docs test passes for every M2 operation; README and
      CHANGELOG updated.
- [x] Surface snapshot diff is additive only; conformance tables complete.
- [x] `npm run check` passes in Node 24 and Chromium; the coverage check
      reports no unimplemented or unverified M2A REQ and no orphan tag.
- [x] Gate result reported to the user.
