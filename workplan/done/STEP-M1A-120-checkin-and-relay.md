---
id: STEP-M1A-120
title: Check-in steps, relay interface, default relay, one-call check-in
milestone: M1A
implements: ["REQ-SYS-004", "REQ-SYS-005", "REQ-SYS-006", "REQ-SYS-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-110"]
evidence:
  commits: ["c77c031"]
  tests: ["verifies: REQ-SYS-004", "verifies: REQ-SYS-005", "verifies: REQ-SYS-006", "verifies: REQ-SYS-007", "verifies: REQ-NET-007"]
  notes: "npm run check: 335 passed in Node 24 and headless Chromium. client.system.getCheckin/postCheckin/checkin; EncedoCheckinRelay (default URL https://api.encedo.com/checkin, configurable url/fetch/timeoutMs) and the CheckinRelay interface (exchange). The shared time-limit/abort race moved into fetchWithLimit, used by the transport and the relays; relays do not use the device queue. Relay errors other than HemError are wrapped in HemRelayError; the failing leg is reported in error.operation."
reopened: []
cancelled: null
---

**Goal:** The two device steps of check-in are bound on `client.system`;
`src/relay/checkin.ts` exports the check-in relay interface and the default
relay for `https://api.encedo.com/checkin`; a one-call check-in runs the
three legs in order.

**Notes:** Step 1 returns `check` unmodified. Step 2 posts `{checked}` and
returns `status` plus `newcrt`, `newfws`, `newuis` when present; a 401
raises `HemUnauthenticatedError` with no login attempt. Default relay: POST
JSON `{check}`, return `checked`; own `fetch` (global by default, never the
device `fetch`); URL configurable; a status other than 200 is an error
carrying status and body. One-call check-in: a failure names the leg; no
relay configured raises `HemUnsupportedError`; a check-in never triggers
another check-in (matters once STEP-M1A-130 adds recovery). The TSDoc of
step 2 lists the management actions `L`, `W`, `B`, `U`, `R` and the
trusted-backend condition [YAML].

**Definition of done**
- [x] Step 1: no `Authorization`; returns `check` unmodified; a reply without `check` raises `HemProtocolError`
- [x] Step 2: body `{checked}` unmodified; no `Authorization`; result has `status` and `newcrt`, `newfws`, `newuis` when present; a 401 raises `HemUnauthenticatedError` without any login request
- [x] Step 2's documentation lists the management actions and the condition under which they run
- [x] The default relay posts JSON `{check}` and returns `checked`; it uses its own `fetch`, never the device one; the URL is configurable; a non-200 status raises an error carrying status and body
- [x] The client accepts any implementation of the exported relay interface; a unit test runs a full check-in with an in-memory relay and no request leaves for `api.encedo.com`
- [x] One-call check-in: the legs run in order with each value passed unchanged; the result is step 2's result; a failure names the leg; no relay raises `HemUnsupportedError`; a check-in never triggers another
