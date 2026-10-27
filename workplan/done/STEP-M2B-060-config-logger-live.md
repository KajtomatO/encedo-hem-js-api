---
id: STEP-M2B-060
title: Config and audit log live
milestone: M2B
implements: ["REQ-SYS-008", "REQ-SYS-009", "REQ-SYS-010", "REQ-SYS-011", "REQ-API-011"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M2B-050"]
evidence:
  commits: ["598bc60", "7d104a8"]
  tests: ["verifies: REQ-SYS-008, REQ-SYS-009, REQ-SYS-010, REQ-SYS-011, REQ-API-011 (tests/integration/config-logger.test.ts, live 2026-10-27)"]
  notes: "Live 2026-10-27 against my.ence.do: 3/3 passed in 6.3 s, read-only. Config: all 19 required fields and all 5 optional ones present (mass-storage build); key material 32 bytes each; email empty. Hardware: PPA rev 2.2, FW v1.2.2-DIAG, two storage slots. Logger key 32/32/64; nonce identical on two calls within a second (time-based). 64 log files; the current boot's file → 406 (being written), the previous one downloaded: text/plain, 10329 bytes, 162 CRLF lines, '#' firmware banner then pipe-delimited records; unknown id → HemUnsupportedError 404 naming both causes. No key created, nothing changed."
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
- [x] Configuration read; presence of optional fields and the hardware
      build recorded in REQ-SYS-008 and REQ-API-011.
- [x] Logger key lengths recorded (REQ-SYS-009).
- [x] Log files listed and one downloaded, content type and format sample
      recorded (REQ-SYS-010, REQ-SYS-011) — or the no-mass-storage finding.
- [x] The integration test passes live; the summary (counts, time) is in
      `evidence.notes`.
- [x] Every `(M2B)` box of the REQs above is ticked with its finding, or
      carried forward by a recorded user decision; revisions bumped.
- [x] No `EHEMTEST` key remains on the device.
