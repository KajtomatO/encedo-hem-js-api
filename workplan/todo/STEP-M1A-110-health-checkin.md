---
id: STEP-M1A-110
title: Health, check-in and the check-in relay
milestone: M1A
implements: ["REQ-SYS-003", "REQ-SYS-004", "REQ-SYS-005", "REQ-SYS-006", "REQ-SYS-007", "REQ-NET-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#7-transport"]
depends_on: ["STEP-M1A-100"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.system.health()` answers "can I use the device now" with
one request and without throwing for an unreachable device; check-in works
as its two device calls, a replaceable relay, and a one-call convenience.

**Notes:**
- Health (REQ-SYS-003) is built on the status call: reachable, initialised,
  `fls_state` equal to 0, clock set, plus a summary flag. Unreachable and
  timed out become a result; a caller abort still throws.
- Check-in step 1 is `GET /api/system/checkin`, step 2 is `POST
  /api/system/checkin` with `{checked}` [YAML]. Neither takes a token. A 401
  on step 2 is reported as it is — a public operation never triggers a
  login.
- The TSDoc of step 2 lists the management actions a backend reply can carry
  and the condition under which the device runs them, from [YAML] as
  recorded in REQ-SYS-005.
- Relay (REQ-SYS-006): an exported interface in `src/relay/` and a default
  implementation that posts `{check}` to `https://api.encedo.com/checkin`
  and returns `checked` [C-SDK]. It uses its own `fetch` (the global one by
  default), never the device `fetch`, and its requests do not pass through
  the device queue (REQ-NET-007).
- Open point — error class for a failed relay call. REQ-SYS-006 asks for
  "an error carrying the status and body" and REQ-API-002 wants every
  failure to be an exported error class, but the ARCHITECTURE.md §4 table
  has no class for the cloud side. Propose one when implementing; if that
  means changing the §4 table, stop and raise it with the user first
  (REQUIREMENTS-MANAGEMENT.md §6.2).
- One-call check-in (REQ-SYS-007): the three legs in order, values passed on
  untouched, a failure naming its leg.
- Unit tests substitute the relay's `fetch`; nothing reaches
  `api.encedo.com`.
- Closed elsewhere: REQ-SYS-007 "a check-in never triggers another
  check-in" in STEP-M1A-150, where recovery exists (listed there). Partly
  closed here: REQ-NET-007 (relay requests outside the queue).

**Definition of done**
- [ ] `system.health()` makes exactly one request, the status request.
- [ ] An unreachable device or an elapsed time limit yields a result with
      reachable false and no throw; a caller abort raises `HemAbortError`.
- [ ] Health maps initialised, `fls_state` equal to 0 and clock set from the
      status result; the summary flag is true only when all four facts are.
- [ ] Check-in step 1: no `Authorization` header; the result is the `check`
      string unmodified; a reply without `check` raises `HemProtocolError`.
- [ ] Check-in step 2: body `{checked}` with the reply unmodified, no
      `Authorization` header; the result has `status`, and `newcrt`,
      `newfws` and `newuis` when present.
- [ ] Check-in step 2: a 401 raises `HemUnauthenticatedError` without a login
      attempt; its TSDoc lists the management actions and when they run.
- [ ] Default relay: a POST with JSON `{check}` returns the `checked` string;
      it uses its own `fetch`, never the device `fetch`; the URL is
      configurable; a status other than 200 raises an error carrying the
      status and body.
- [ ] The relay interface is exported and the client accepts any
      implementation; a test runs a check-in with an in-memory relay and
      makes no request to `api.encedo.com`.
- [ ] One-call check-in: the three legs happen in order and each value is
      passed on unchanged; the result is that of step 2; a failure names the
      leg; with no relay configured it raises `HemUnsupportedError`.
- [ ] Relay requests do not pass through the device request queue.
- [ ] Each operation has unit tests asserting method, path, headers, body and
      response mapping, and TSDoc stating scope and milestone.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
