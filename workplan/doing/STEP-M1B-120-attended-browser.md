---
id: STEP-M1B-120
title: Attended — browser origin against the device and the cloud relays
milestone: M1B
implements: ["REQ-NET-009", "REQ-NET-011", "REQ-AUTH-017", "REQ-SYS-006"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-040"]
evidence:
  commits: ["80d588b"]
  tests: ["verifies: REQ-NET-009, REQ-NET-011, REQ-AUTH-017, REQ-SYS-006 (tests/attended/browser.test.ts, 2026-10-12)"]
  notes: "Run 2026-10-12, no physical action needed. Device configuration read (read-only system:config): origin '*', trusted_backend true. Headless Chromium 153 with pages served by request interception at https://app.example and http://localhost:8080: with the local-network-access permission granted, status, login + keys.list (preflighted), check-in through api.encedo.com and the broker session all succeeded; without it every device call failed in the browser (Local Network Access), the broker still worked. Device CORS correct (origin echoed, preflight 204 allowing Authorization). Open: REQ-NET-011's disallowed-origin case is not observable under '*' without a configuration write (not permitted in M1B) — needs the user's decision at the gate; the step stays in doing/ until then."
reopened: []
cancelled: null
---

**Goal:** A page in a browser calls the device with an allowed and with a
disallowed origin; the device's allow-list and whether the cloud relays
accept a browser origin are recorded. Settles Q6 and §11 risk 11.

**Notes:**
- Attended: the user reads the device's `origin` setting first, with the C
  client's config read (it exposes the field) or from the dashboard —
  config read is M2A here. Record it (REQ-NET-011). State and stop before
  starting.
- Vitest browser project `browser-integration` (Chromium through Playwright
  with `ignoreHTTPSErrors` for the device certificate), serving the page at
  `http://localhost:<port>`. Public endpoints work over `http:` too; key and
  crypto calls need `https:`.
- Allowed half (REQ-NET-009): passes only if the page's origin is on the
  device's list. If it is not, the user either adds it outside this library
  (dashboard or a config write) or carries REQ-NET-009's box to M3B by
  explicit decision, written next to the box.
- Disallowed half (REQ-NET-011): expect 412 → `HemOriginRejectedError`.
- Relays from the page: the broker's session call (no push, no device) and
  a real check-in through the default check-in relay — record whether the
  browser's CORS preflight passes (REQ-AUTH-017 and REQ-SYS-006, browser
  halves; risk 11).

**Definition of done**
- [ ] Device allow-list recorded; a disallowed origin gives
      `HemOriginRejectedError` (REQ-NET-011).
- [x] An allowed origin passes preflight and succeeds, or the box is carried
      to M3B by recorded decision (REQ-NET-009).
- [x] Whether the broker and the check-in backend accept a browser origin is
      recorded (REQ-AUTH-017, REQ-SYS-006; §11 risk 11).
- [x] The browser test skips without the opt-in and is tagged `verifies:`;
      findings next to the boxes.
