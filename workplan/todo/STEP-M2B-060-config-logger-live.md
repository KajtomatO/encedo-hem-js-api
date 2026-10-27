---
id: STEP-M2B-060
title: Config and audit log live
milestone: M2B
implements: ["REQ-SYS-008", "REQ-SYS-009", "REQ-SYS-010", "REQ-SYS-011", "REQ-API-011"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-050"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The configuration and the audit log are read from the test device; field presence, key-material lengths, the hardware build and a log-format sample are recorded.

**Notes:**
- B step: state what it does to the device and stop until the user says go.
  Run as `set -a; . <hem.env>; set +a; npm run test:integration -- <file>`;
  every key is `EHEMTEST`-labelled and deleted afterwards (REQ-TEST-006).
- `tests/integration/config-logger.test.ts`. Read-only: nothing on the
  device is changed and no key is created. Reads the configuration and
  records which optional fields are present and the hardware build
  (storage fields, `genuine_id`); reads the logger key and records the
  three lengths; lists the log files (offset 0 and a second page if
  `total` allows) and downloads the newest one, recording the content type
  and the first lines with any secret-looking value masked. If the device
  has no mass storage, listing and download are expected to raise
  `HemUnsupportedError`; record that and carry the format criteria by the
  user's decision.
- Config values (user, email, hostname, ip) are the user's data: record
  presence, not values.

**Definition of done**
- [ ] Configuration read; presence of optional fields and the hardware
      build recorded in REQ-SYS-008 and REQ-API-011.
- [ ] Logger key lengths recorded (REQ-SYS-009).
- [ ] Log files listed and one downloaded, content type and format sample
      recorded (REQ-SYS-010, REQ-SYS-011) — or the no-mass-storage finding.
- [ ] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [ ] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [ ] No `EHEMTEST` key remains on the device.
