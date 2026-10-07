---
id: STEP-M1B-040
title: Check-in and health, live
milestone: M1B
implements: ["REQ-SYS-003", "REQ-SYS-004", "REQ-SYS-005", "REQ-SYS-006", "REQ-SYS-007"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1B-030"]
evidence:
  commits: ["0075a60"]
  tests: ["verifies: REQ-SYS-003, REQ-SYS-004, REQ-SYS-005, REQ-SYS-006, REQ-SYS-007 (tests/integration/checkin-health.test.ts, live 2026-10-07)"]
  notes: "Live 2026-10-07 against my.ence.do: 3/3 passed in 5.4 s. Two-step check-in 1010 ms end to end (backend round trip 268 ms), one-call check-in 564 ms, both status OK, clock set afterwards, no newcrt/newfws/newuis. The check-in corrected a clock that had drifted 19 minutes ahead in 4.2 h since the sweep's sync (about 9 % fast — quirk 17 confirmed live; feeds §11 at the gate). Backend reply carried only status OK, so no management action was observed; whether the trusted-backend option is on remains unknown. The sweep logged in without a check-in (clock already set)."
reopened: []
cancelled: null
---

**Goal:** Check-in runs live in its two device steps and as the one-call
convenience against the real Encedo backend, leaves the clock set, and
`health()` then reports all four true.

**Notes:**
- B step: state and stop first. What it does to the device: a check-in sets
  the device clock and applies whatever the backend reply carries — with the
  device's trusted-backend option on, that can include management actions
  [YAML]. Live check-in is permitted by the user (REQ-TEST-005).
- Sequence: `checkinGet` → default relay → `checkinPost`; then `checkin()`;
  then `status` shows the clock set (REQ-SYS-005). Record the backend's
  reply (REQ-SYS-006) and whether `newcrt` is reported (REQ-SYS-007; §6
  quirk 16).
- The default relay reaches `api.encedo.com` through `globalThis.fetch`, not
  the relaxed device `fetch` (REQ-SYS-006) — keep it that way in the test.
- REQ-SYS-003, healthy half: reachable, initialised, no latched fault, clock
  set, all true. The unplugged half is STEP-M1B-090; the browser-origin half
  of REQ-SYS-006 is STEP-M1B-120.

**Definition of done**
- [x] `checkinGet` returns a check-in token (REQ-SYS-004); `checkinPost`
      with the backend reply completes and `status` reports the clock set
      (REQ-SYS-005).
- [x] `checkin()` returns status `OK` and leaves the clock set; whether
      `newcrt` is reported is recorded (REQ-SYS-007).
- [x] The real backend's reply for the test device is recorded (REQ-SYS-006,
      backend half).
- [x] `health()` reports all four true (REQ-SYS-003, healthy half).
- [x] Integration tests tagged `verifies:`; findings next to the boxes.
