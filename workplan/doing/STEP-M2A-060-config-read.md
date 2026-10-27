---
id: STEP-M2A-060
title: Config read
milestone: M2A
implements: ["REQ-SYS-008"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: []
  tests: []
  notes: null
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
- [ ] Body-less GET with scope `system:config`; the result exposes every
      required field, key material as bytes; optional fields only when
      present; a missing required field raises `HemProtocolError`.
- [ ] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [ ] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [ ] `npm run surface:update` adds entries only; `npm run check` passes.
