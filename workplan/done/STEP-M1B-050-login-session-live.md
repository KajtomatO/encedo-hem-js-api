---
id: STEP-M1B-050
title: Passphrase login and session, live
milestone: M1B
implements: ["REQ-AUTH-001", "REQ-AUTH-006", "REQ-AUTH-007", "REQ-AUTH-010"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-040"]
evidence:
  commits: ["747013e"]
  tests: ["verifies: REQ-AUTH-001, REQ-AUTH-006, REQ-AUTH-007, REQ-AUTH-010 (tests/integration/login-session.test.ts, live 2026-10-09)"]
  notes: "Live 2026-10-09 against my.ence.do: 6/6 passed in 50.8 s (35 s of it the renewal wait). Clock drift found before the sync: +14 247 s after ~50 h without a check-in, about 7.9 % fast (quirk 17; the check-in zeroed it). Logins take ~720 ms each (the device's deliberate ≥ 500 ms delay plus PBKDF2 and the round trip) — feeds REQ-NET-004 at the gate. The device copies the requested expiry: 8 h, 24 h, 7 d and 90 s were all issued as requested (§11 risk 8: no cap found up to 7 d). Two wrong-passphrase attempts: 401 in ~720 ms each, no escalation; a correct login followed. Master role carried to M3B (no master passphrase). Q1 (§11) re-verified by this library."
reopened: []
cancelled: null
---

**Goal:** The library logs in unattended against the device; token lifetime,
renewal and role are verified live; a wrong passphrase is measured. This
re-verifies Q1 (§11) with this library.

**Notes:**
- B step: state and stop first. What it does to the device: logins, among
  them at most three wrong-passphrase attempts per run, ending with a
  correct one — the device delays login responses to ≥ 500 ms and to
  1500 ms after three consecutive failures [YAML].
- REQ-AUTH-001: decode the bearer's payload in the test (no verification):
  `sub` is `U`, `scope` equals the requested scope. Wrong passphrase →
  `HemUnauthenticatedError`; record the observed delay.
- REQ-AUTH-006: default lifetime → `exp - iat` about 8 h in the issued
  token. Probe above 8 h (24 h, 7 d): record whether the device copies,
  clamps or rejects (§11 risk 8).
- REQ-AUTH-007: `tokenLifetimeSeconds: 90` with the 60 s margin → the token
  counts as expired after 30 s; a call after that logs in again (count
  `POST /api/auth/token` with a counting `fetch`). Whether the device
  accepts a 90 s lifetime is itself a finding.
- REQ-AUTH-010: the user passphrase reports the user role. No master
  passphrase exists for this device (user, 2026-10-06), so the master box is
  carried to M3B — write that next to it.
- Record login wall-clock times; they feed REQ-NET-004 at the gate.

**Definition of done**
- [x] Unattended login succeeds; `sub` is `U` and `scope` is the requested
      scope (REQ-AUTH-001).
- [x] Wrong passphrase raises `HemUnauthenticatedError`; the delay is
      recorded (REQ-AUTH-001).
- [x] The default token lives about 8 h; the above-8 h probe and the
      device's reaction are recorded (REQ-AUTH-006; §11 risk 8).
- [x] With a short lifetime a call past the margin triggers a login and
      succeeds (REQ-AUTH-007).
- [x] The user role is reported; the master box is carried to M3B with the
      reason (REQ-AUTH-010).
- [x] Integration tests tagged `verifies:`; findings next to the boxes.
