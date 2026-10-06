---
id: STEP-M1A-250
title: Safe improvements ported from the alternative M1A implementation
milestone: M1A
implements: ["REQ-NET-002", "REQ-API-001", "REQ-API-005", "REQ-API-008"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1A-240"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The improvements the review of 2026-10-06 found in the alternative
implementation (branch `claude/jolly-dijkstra-6cws4p`) that do not reshape
the public API are ported: a `URL` instance as the device address, relay
options checked at construction, a boundary-value test over every
documented limit, one global test timeout, and a source rule against
module-level state.

**Notes:**
- Out of scope by user decision 2026-10-06: namespaces as interfaces, an
  explicit `auth.login()` returning session information, approvals returning
  session information instead of the token, and a relay `getKey` that keeps
  the broker key's expiry. Each would change existing snapshot entries.
- `url: string | URL` widens an input type. The snapshot test reports the
  changed entry as breaking because it compares signatures textually; the
  entry in `tests/surface/public-api.txt` is updated by hand and the
  evidence states why this is additive (REQ-API-008).
- Relay options (REQ-API-001): a non-null `checkinRelay` without `exchange`,
  or `approvalRelay` without `getKey`, `submit` and `check`, is a
  construction error naming the option, so a misconfigured client fails
  before any I/O instead of at its first check-in or approval.
- Limits (REQ-API-005): one table in `tests/unit/conformance.test.ts` sends
  the boundary value of every documented limit and refuses the first value
  past it with zero `fetch` calls, so a limit that is loosened or lost by
  accident is caught in one place.
- Test timeout: 74 tests carry a 60 s argument for the PBKDF2 runs in the
  browser; one `testTimeout` in `vitest.config.ts` replaces them (chore).
- Source rule (REQ-API-001, "no module-level state"): module-level `let` and
  `var` in `src/` are refused by the source check; `const` bindings of
  frozen values stay allowed.

**Definition of done**
- [ ] `HemClientOptions.url` accepts a `URL` instance; the device-URL table
      test has a `URL` row; the snapshot entry is updated and the evidence
      says why the change is additive.
- [ ] A non-null relay option lacking the interface's methods raises
      `HemValidationError` naming the option, with no request made.
- [ ] A table test sends every documented limit's boundary value and
      refuses the first value past it with `HemValidationError` and zero
      `fetch` calls.
- [ ] One global `testTimeout` replaces the per-test timeouts.
- [ ] The source check refuses module-level `let` and `var` in `src/`, with
      bad samples in its test.
- [ ] The README documents `url` as a string or `URL`.
- [ ] `npm run check` passes in Node 24 and in headless Chromium.
