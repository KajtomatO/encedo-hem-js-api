---
id: REQ-TEST-004
title: Disruptive tests never run automatically
status: verified
priority: must
revision: 4
source: CLAUDE.md; ARCHITECTURE.md §8; ARCHITECTURE.md §1
depends_on: ["REQ-TEST-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#1-decisions-fixed"]
---

# Disruptive tests never run automatically

A test that reboots, shuts down, wipes, upgrades or provisions a device
SHALL NOT run unless a person has both set a dedicated opt-in variable and
started that specific test.

**Rationale:** These actions can leave the device unusable until someone
power-cycles or re-provisions it. They happen only when the user has decided
to do them. Introduced in M1B.

**Acceptance criteria:**
- [x] Such tests live under `tests/attended/` and are excluded from the
      default command, the integration command and CI.
- [x] Each checks the opt-in variable and skips without it (`describeAttended`
      in the test harness).
- [x] No script, hook or CI job sets the opt-in variable.
- [x] Each prints what it is about to do to the device before doing it —
      `say`/`yourTurn` in the harness: the power-cycle test prints its plan
      and each requested action before waiting for it; the parallel probe
      says what it does before sending (tests/attended/, 2026-10-12).
