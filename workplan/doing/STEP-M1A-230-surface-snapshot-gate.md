---
id: STEP-M1A-230
title: Public-surface snapshot, cross-binding conformance, A gate
milestone: M1A
implements: ["REQ-API-008", "REQ-API-004", "REQ-AUTH-005", "REQ-AUTH-012", "REQ-NET-003", "REQ-NET-009", "REQ-TEST-001"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M1A-030", "STEP-M1A-220"]
evidence:
  commits: ["abefa20", "12f778b", "b2f05ac"]
  tests: ["verifies: REQ-API-008 (tests/unit/surface.node.test.ts, tests/unit/surface.test.ts)", "verifies: REQ-AUTH-005 (tests/unit/conformance.test.ts, tests/unit/no-token-parameter.node.test.ts)", "verifies: REQ-AUTH-012 (tests/unit/conformance.test.ts)", "verifies: REQ-NET-003 (tests/unit/conformance.test.ts)", "verifies: REQ-NET-009 (tests/unit/conformance.test.ts)", "verifies: REQ-TEST-001 (tests/unit/conformance.test.ts)", "supports: REQ-API-008 (tests/support/surface.ts)"]
  notes: "npm run check on 2026-10-05: build, type-check and 73 files / 1109 tests pass in Node v24.21.0 and headless Chromium; the REQ-AUTH-002 vector test passes in both. Surface snapshot: tests/surface/public-api.txt (one entry per exported declaration and public member, from the emitted .d.ts), regenerated for additions with `npm run surface:update`. Conformance tests walk ALL_OPERATIONS (17 operation descriptions) and fail for any operation missing from their table. REQ-API-004 fourth criterion: user decision 2026-10-05 — relay-carried values (epk, authreq, authreply, check, checked) and newfws/newuis stay strings as opaque tokens, as in https://github.com/KajtomatO/encedo-hem-c-api and in Encedo Manager (https://github.com/encedo/encedo-manager), which both pass them through untouched. OPEN: networking-disabled run (REQ-TEST-001 fourth criterion) — unprivileged network namespaces are blocked on the dev machine (kernel.apparmor_restrict_unprivileged_userns=1, no passwordless sudo), so the run needs the user. OPEN until the 0.1.0 release: REQ-API-008 third criterion (snapshot frozen at release)."
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
- [x] A snapshot of the public surface is committed; a unit test fails when
      an entry changes or disappears and passes when entries are only added.
- [x] A table-driven test over every authenticated M1 operation shows the
      scope requested at login equals the one listed in ARCHITECTURE.md §6;
      crypto operations and key get request `keymgmt:use:<kid>` with the key
      id in lower-case hex.
- [x] No device operation has a parameter for passing a token.
- [x] With tokens cached, the calls for status, version, check-in (both
      steps), login (both steps), `ext/request` and `ext/token` carry no
      `Authorization` header.
- [x] Every key-management and crypto operation called on an `http:` client
      raises `HemTlsRequiredError` with zero `fetch` calls; system and auth
      operations on an `http:` client are sent.
- [x] A unit test records the headers of every binding's request and finds
      only names from the allow-list.
- [x] Every binding has at least one unit test asserting the request's
      method, path, headers and body, and the mapping of its response.
- [x] No public operation takes or returns base64 text for a binary value,
      apart from the stated exceptions; the open point on relay-carried
      strings is settled with the user.
- [ ] The unit suite passes with networking disabled; the method is noted in
      the evidence.
- [x] The local check script passes: build, type-check, unit suite in Node 24
      and in the headless browser; the login vector reproduces byte for byte
      in both.
- [x] The trace matrix is regenerated: all 64 M1A REQs have `implements:` and
      `verifies:` tags; any non-`(M1B)` acceptance box still open is listed
      with its reason.
- [ ] The gate result is reported to the user.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
