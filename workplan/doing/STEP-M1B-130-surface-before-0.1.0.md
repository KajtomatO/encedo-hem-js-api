---
id: STEP-M1B-130
title: Public-surface changes before 0.1.0
milestone: M1B
implements: []
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M1B-010"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The four surface changes deferred at the M1A review of 2026-10-06
land before 0.1.0 freezes the public API (D13):

1. namespaces (`client.auth`, `client.keys`, …) typed as interfaces instead
   of exported classes;
2. `auth.login(scope)` returning a `SessionInfo` (role, scope, expiry);
3. the approval calls (`approve`, `waitForApproval`, `redeemApproval`)
   returning `SessionInfo` instead of the raw token string;
4. `ApprovalRelay.getKey` returning the broker key together with its `exp`.

**Notes:**
- `implements` is empty because these are design refinements chosen by the
  user (all four, 2026-10-06), not new requirements. They touch REQs whose
  criteria mention the changed signatures (at least REQ-API-001,
  REQ-AUTH-001, REQ-AUTH-015, REQ-AUTH-017, REQ-AUTH-018): the step starts
  with a §6.2 impact analysis over them and stops for approval before
  editing; verified REQs whose criteria change go through `needs-reverify`
  and back.
- The surface snapshot changes on purpose: regenerate it with
  `npm run surface:update` and review the diff entry by entry — only the
  four changes, nothing else.
- Pure A-type work (no device). Unit tests, TSDoc and README follow the
  new signatures.

**Definition of done**
- [ ] Impact analysis presented and approved; affected REQs updated with
      revision bumps.
- [ ] Namespaces are interfaces; the classes are no longer exported.
- [ ] `auth.login(scope)` returns `SessionInfo`.
- [ ] Approval calls return `SessionInfo`.
- [ ] `ApprovalRelay.getKey` returns the key with its `exp`; the default
      relay and the approval engine use it.
- [ ] Surface snapshot diff contains only these changes; unit tests, TSDoc
      and README updated; the suite passes in Node 24 and the browser run.
