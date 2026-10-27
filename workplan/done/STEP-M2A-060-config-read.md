---
id: STEP-M2A-060
title: Config read
milestone: M2A
implements: ["REQ-SYS-008"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: ["5e82a2d"]
  tests: ["verifies: REQ-SYS-008 (tests/unit/system-config.test.ts)"]
  notes: "npm run check on 2026-10-27: 96 files, 2013 tests passed in Node v24.21.0 and headless Chromium. All 19 fields the reference marks required are required (iat, uts, dnsd, ctx and the two http_option fields included); if the device omits one of them the (M2B) check will show it and the list can be relaxed then. Names: iat/uts → createdAt/updatedAt, trusted_ts → trustedTime (as system.status), http_option_hsts → hsts, http_option_dosprot_mode → dosProtectionMode; the TSDoc states the device's names. Not TLS-only (the reference lists no 418 for it; conformance keeps TLS-only to keymgmt and crypto). The reference's scope is 'system:config OR logger:get OR auth:ext:pair'; the library uses system:config per the REQ. Surface snapshot: 26 additions."
reopened: []
cancelled: null
---

**Goal:** `client.system.config()` returns the device configuration and identity keys with key material as bytes.

**Notes:**
- `src/api/system.ts`; `GET /api/system/config`; scope `system:config`.
- Required fields per [YAML] (`devid`, `eid`, `eid_sign`, `user`, `email`,
  `hostname`, `origin`, `trusted_ts`, `trusted_backend`, `allow_keysearch`,
  `ip`, `spk`, `nonce`, …): a missing one is `HemProtocolError`
  (REQ-API-006); optional ones (`instanceid`, the mass-storage fields) are
  present only when sent. Decide per field from the reference which are
  base64 bytes and which stay strings; relay-style opaque values stay
  strings as decided for REQ-API-004 (2026-10-05).

**Definition of done**
- [x] Body-less GET with scope `system:config`; the result exposes every
      required field, key material as bytes; optional fields only when
      present; a missing required field raises `HemProtocolError`.
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
