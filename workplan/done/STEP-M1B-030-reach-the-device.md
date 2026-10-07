---
id: STEP-M1B-030
title: Reach the device — address, TLS trust, status and version, live
milestone: M1B
implements: ["REQ-NET-001", "REQ-NET-002", "REQ-NET-006", "REQ-NET-012", "REQ-SYS-001", "REQ-SYS-002"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-020"]
evidence:
  commits: ["7197be3", "1d72e2d"]
  tests: ["verifies: REQ-NET-001, REQ-NET-002, REQ-NET-006, REQ-NET-012, REQ-SYS-001, REQ-SYS-002 (tests/integration/reach.test.ts, live 2026-10-07)"]
  notes: "Live runs 2026-10-07 against my.ence.do (fw 1.2.2-DIAG) through the Node transport: npm run test:integration → 7/7 passed (harness smoke + 5 reach tests + guard check), 7.3 s with 150 ms pacing. First run: the device had been power-cycled, clock unset, the sweep's login triggered one automatic check-in and succeeded (REQ-NET-013 and a first sighting of REQ-AUTH-009's cold-boot recovery, to be confirmed formally in STEP-M1B-090). Ten consecutive status calls 2.2–2.5 s (§11 risk 3 closed). The step was paused mid-way by the header-case finding (quirk 18), which produced REQ-NET-013 and STEP-M1B-035; the device stalled once after ~40 raw probes and was power-cycled by the user (§11 risk 6). Not observable: an expired certificate (renewed 2026-10-07). Findings written next to every (M1B) box the step lists; the powered-off half of REQ-NET-006 is STEP-M1B-090."
reopened: []
cancelled: null
---

**Goal:** The first live calls: `system.status()` and `system.version()`
succeed by hostname and by IP address with the TLS trust the README
documents; the device's certificate and the transport failure classes are
recorded.

**Notes:**
- Paused 2026-10-07 after the first live run: the sweep's login — a POST —
  got 411 because the firmware matches header names case-sensitively and
  Node's `fetch` writes `content-length` in lowercase (§6 quirk 18; report
  in `docs/`). The device also stalled after the probes and was
  power-cycled. Resumes after STEP-M1B-035 (Node transport), with
  `createNodeFetch` for the CA and IP cases.
- B step: before anything runs, state what it does to the device (read-only
  status and version calls, TLS handshakes) and what the user has to do
  (device plugged in, `hem.env` sourced), then stop until told to go (§5.5).
- Addresses: `https://my.ence.do` and the device's IP (REQ-TEST-005). By IP
  the certificate still names `my.ence.do`, so the README's `servername`
  method is the one used — that is REQ-NET-012's "documented method".
- Certificate: record issuer, subject and validity (REQ-NET-012). If it has
  expired, the user renews it with the C client's cert-install (attended,
  reboots the device) or the run uses `EHEM_TEST_INSECURE=1`; either way the
  finding is recorded.
- REQ-NET-006, two of three parts: a name that does not resolve
  (`https://no-such-host.invalid`) and, if the device's certificate is
  expired, an expired certificate — record what Node's `fetch` reports and
  that it maps to `HemUnreachableError`. The powered-off part is
  STEP-M1B-090.
- Record the live `status` and `version` JSON next to the `(M1B)` boxes of
  REQ-SYS-001/002 and in REQ-TEST-005's device record (firmware `-DIAG`,
  mass storage, clock state).
- Risk 3 (connection reuse after the device closes TCP): note whether
  consecutive calls through Node's `fetch` show any error; the finding goes
  into §11 at the gate (STEP-M1B-140).

**Definition of done**
- [x] Status and version succeed by hostname and by IP, each through the
      README-documented `fetch` (REQ-NET-001, REQ-NET-002, REQ-NET-012);
      live responses recorded in REQ-SYS-001/002 and REQ-TEST-005.
- [x] Certificate issuer, subject and validity recorded in REQ-NET-012.
- [x] Unresolvable name and, where observable, expired certificate: Node's
      `fetch` error recorded in REQ-NET-006 and mapped to
      `HemUnreachableError` (expired certificate not observable: renewed
      2026-10-07).
- [x] Integration tests tagged `verifies:` for the REQs above; each `(M1B)`
      box settled here carries its finding.
