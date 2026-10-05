---
id: STEP-M1A-230
title: Public-surface snapshot, cross-binding conformance, A gate
milestone: M1A
implements: ["REQ-API-008", "REQ-API-004", "REQ-AUTH-005", "REQ-AUTH-012", "REQ-NET-003", "REQ-NET-009", "REQ-TEST-001"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M1A-030", "STEP-M1A-220"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The M1 public surface is recorded in a committed snapshot,
table-driven tests prove the cross-cutting rules for every M1 operation, and
the M1A gate of ARCHITECTURE.md §8 and §10 is run and reported.

**Notes:**
- Snapshot (REQ-API-008): exported names and signatures, taken from the
  emitted declarations. Its test fails on a changed or missing entry and
  passes on additions.
- REQ-API-008's third criterion — the snapshot is frozen when a release is
  cut — cannot close before the 0.1.0 release (REQ-BUILD-006, M1B). It
  carries no `(M1B)` prefix; this was reported to the user on 2026-10-05.
  It stays unticked here and is named in the gate report.
- The conformance tests walk the operation descriptions introduced in
  STEP-M1A-100, so they cover every operation without a hand-kept list:
  - the scope requested at login against the table in ARCHITECTURE.md §6
    (REQ-AUTH-005);
  - no `Authorization` header on any public operation while tokens are
    cached (REQ-AUTH-012);
  - every key-management and crypto operation refused on an `http:` client
    (REQ-NET-003);
  - the headers of every binding's request against the allow-list
    (REQ-NET-009);
  - at least one request-and-response unit test per binding (REQ-TEST-001).
- REQ-API-004, fourth criterion: review the surface for base64 text standing
  in for binary values. Open point carried from STEP-M1A-190: `epk`,
  `authreq`, `authreply`, `check` and `checked` are relay-carried opaque
  strings. Confirm with the user that they fall under the REQ's "opaque
  tokens" exception before ticking the box.
- Networking disabled (REQ-TEST-001, fourth criterion): run the suite where
  no network is reachable, for example inside an empty network namespace;
  write down how it was done.
- A gate (ARCHITECTURE.md §8): build, type-check and unit suite pass in Node
  24 and in a headless browser with no device; every REQ of the part has
  `implements:` and `verifies:` tags. For M1A the login vector must also
  reproduce byte for byte (ARCHITECTURE.md §10).
- The gate result is reported to the user. M1B is decomposed only after the
  gate has passed (REQUIREMENTS-MANAGEMENT.md §5.5).

**Definition of done**
- [ ] A snapshot of the public surface is committed; a unit test fails when
      an entry changes or disappears and passes when entries are only added.
- [ ] A table-driven test over every authenticated M1 operation shows the
      scope requested at login equals the one listed in ARCHITECTURE.md §6;
      crypto operations and key get request `keymgmt:use:<kid>` with the key
      id in lower-case hex.
- [ ] No device operation has a parameter for passing a token.
- [ ] With tokens cached, the calls for status, version, check-in (both
      steps), login (both steps), `ext/request` and `ext/token` carry no
      `Authorization` header.
- [ ] Every key-management and crypto operation called on an `http:` client
      raises `HemTlsRequiredError` with zero `fetch` calls; system and auth
      operations on an `http:` client are sent.
- [ ] A unit test records the headers of every binding's request and finds
      only names from the allow-list.
- [ ] Every binding has at least one unit test asserting the request's
      method, path, headers and body, and the mapping of its response.
- [ ] No public operation takes or returns base64 text for a binary value,
      apart from the stated exceptions; the open point on relay-carried
      strings is settled with the user.
- [ ] The unit suite passes with networking disabled; the method is noted in
      the evidence.
- [ ] The local check script passes: build, type-check, unit suite in Node 24
      and in the headless browser; the login vector reproduces byte for byte
      in both.
- [ ] The trace matrix is regenerated: all 64 M1A REQs have `implements:` and
      `verifies:` tags; any non-`(M1B)` acceptance box still open is listed
      with its reason.
- [ ] The gate result is reported to the user.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
