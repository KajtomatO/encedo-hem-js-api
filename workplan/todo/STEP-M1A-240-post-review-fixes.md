---
id: STEP-M1A-240
title: Defects and hygiene found in the review of the two M1A implementations
milestone: M1A
implements: ["REQ-SYS-007", "REQ-AUTH-016", "REQ-API-002", "REQ-API-003", "REQ-NET-006", "REQ-AUTH-008", "REQ-NET-004", "REQ-NET-008", "REQ-AUTH-018", "REQ-AUTH-011", "REQ-TEST-001"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#5-auth--session", "ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1A-230"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The defects and hygiene problems found when this implementation was
reviewed against the alternative one (branch `claude/jolly-dijkstra-6cws4p`,
review of 2026-10-06) are fixed, each with a test; the repository no longer
tracks test artifacts.

**Notes:**
- Custom relays (REQ-SYS-007, REQ-AUTH-016): `system.checkin` called a
  custom relay's `exchange` unwrapped, so a relay that throws a plain
  `Error` or resolves a non-string did not name the failing leg. One guard
  in `src/relay/http.ts` now covers the check-in relay and the three
  approval-relay calls: a `HemError` keeps its class and gets the leg's
  `operation` when it has none; anything else becomes `HemRelayError` with
  the original as `cause`; a non-string reply is a `HemRelayError`.
- Unreadable error body (REQ-API-003, REQ-NET-006): [YAML] documents 413 as
  "connection closed", i.e. a status line followed by a failed body read.
  The transport turned that into `HemUnreachableError`; the helper meant for
  it, `errorFromResponse`, was never called from `src/`. Behaviour change:
  an error status whose body cannot be read is mapped by the status with an
  empty body; a success response whose body cannot be read stays
  `HemUnreachableError`. `errorFromResponse` is removed and the
  status-mapping tests go through the real transport with a substituted
  `fetch`, as REQ-API-002 asks.
- Second 401 (REQ-AUTH-008): the token rejected by the repeated call stayed
  cached, costing the next call one extra 401 round trip.
- Millisecond options (REQ-NET-004, REQ-NET-008, REQ-AUTH-018): `setTimeout`
  fires at once above 2 147 483 647 ms; every such option is capped there,
  including the relays' `timeoutMs`, which was not validated at all.
- Credential tests (REQ-AUTH-011): the "derived once" check was a timing
  heuristic and the "no passphrase retained" check enumerated own
  properties, which never see `#private` fields, so it could not fail. A
  `deriveBits` spy now asserts one PBKDF2 run across two logins; together
  with the eid-change test it covers the criterion. The reflection test is
  removed rather than kept as false assurance.
- `tests/support/setup.ts` tagged `implements:` where test support is
  `supports:` (§4.2); REQ-TEST-001 keeps its `implements:` in
  `vitest.config.ts`.
- Chores (`implements: []` for these two): `.vitest/` failure screenshots
  were committed from STEP-M1A-030 on and only ignored from STEP-M1A-220 on;
  they are untracked here. devDependencies are pinned to the installed
  versions so a fresh `npm ci` builds what was tested.
- Not changed, recorded for the audit trail: STEP-M1A-020 and STEP-M1A-030
  received follow-up commits (`827afb9`, `3536b2c`, `22be228`, `4a9b414`)
  after they were in `done/`, without a reopen; the done files are not
  edited retroactively. Commit `c9a341c` has no `[STEP-…]` prefix (a doc
  change made at the user's request after the gate); history is not
  rewritten. REQ-API-008's second criterion is satisfied by the first test
  in `tests/unit/surface.node.test.ts`; the second test there only enforces
  that additions are recorded in the snapshot.

**Definition of done**
- [ ] `git ls-files .vitest` prints nothing and `.vitest/` stays ignored.
- [ ] `system.checkin` with a relay that throws a plain `Error`, throws a
      `HemError` without `operation`, or resolves a non-string raises a
      `HemError` whose `operation` is `relay.checkin`; the approval engine
      does the same for `getKey`, `submit` and `check` with the default
      relay's operation names.
- [ ] An error response whose body cannot be read is mapped by its status
      with an empty body; a success response whose body cannot be read
      raises `HemUnreachableError`; `errorFromResponse` no longer exists and
      the status-mapping tests go through the transport with a substituted
      `fetch`.
- [ ] After a second 401 the rejected token is not cached: the next call for
      that scope starts with a login challenge.
- [ ] `timeoutMs`, `minIntervalMs`, the approval wait's `timeoutMs` and
      `intervalMs`, and both relays' `timeoutMs` reject values above
      2 147 483 647 with `HemValidationError` and accept that value.
- [ ] A `deriveBits` spy shows one PBKDF2 derivation across two logins, in
      Node and in Chromium; the reflection test over private state is gone.
- [ ] `tests/support/setup.ts` carries `supports:` instead of `implements:`.
- [ ] devDependencies are pinned to the installed versions and `npm ci` is
      in sync with the lock file.
- [ ] `npm run check` passes in Node 24 and in headless Chromium.
