---
id: STEP-M1B-050
title: Passphrase login and session, live
milestone: M1B
implements: ["REQ-AUTH-001", "REQ-AUTH-006", "REQ-AUTH-007", "REQ-AUTH-010"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-040"]
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] Unattended login succeeds; `sub` is `U` and `scope` is the requested
      scope (REQ-AUTH-001).
- [ ] Wrong passphrase raises `HemUnauthenticatedError`; the delay is
      recorded (REQ-AUTH-001).
- [ ] The default token lives about 8 h; the above-8 h probe and the
      device's reaction are recorded (REQ-AUTH-006; §11 risk 8).
- [ ] With a short lifetime a call past the margin triggers a login and
      succeeds (REQ-AUTH-007).
- [ ] The user role is reported; the master box is carried to M3B with the
      reason (REQ-AUTH-010).
- [ ] Integration tests tagged `verifies:`; findings next to the boxes.
