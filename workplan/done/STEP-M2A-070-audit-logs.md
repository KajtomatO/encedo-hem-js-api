---
id: STEP-M2A-070
title: Audit logs: key, listing, download; mass-storage-only errors
milestone: M2A
implements: ["REQ-SYS-009", "REQ-SYS-010", "REQ-SYS-011", "REQ-API-011"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: []
evidence:
  commits: ["8d18947"]
  tests: ["verifies: REQ-SYS-009 (tests/unit/logger.test.ts)", "verifies: REQ-SYS-010 (tests/unit/logger.test.ts)", "verifies: REQ-SYS-011 (tests/unit/logger.test.ts)", "verifies: REQ-API-011 (tests/unit/logger.test.ts, tests/unit/operation-docs.node.test.ts, tests/unit/doc-check.test.ts)"]
  notes: "npm run check on 2026-10-27: 98 files, 2097 tests passed in Node v24.21.0 and headless Chromium. New module src/api/logger.ts, namespace client.logger (key, list, download). Binding core: invoke() now wraps invokeRaw(), which returns the transport response unparsed; OperationSpec gained mscOnly, and unsupportedOn404() maps a 404 of such an operation to HemUnsupportedError (download adds the unknown-file-id cause). The doc checker requires 'mass-storage hardware' in the TSDoc of every mscOnly operation. Logger operations are not TLS-only (the reference lists no 418 for them). REQ-API-011's first two criteria stay open on purpose: their storage, attestation and upgrade parts are M3A (the REQ is verified on the audit-log evidence; the M3A steps that bind those operations will list it again and tick the rest). Key-material lengths (32/32/64) are not enforced; M2B records them. Surface snapshot: 20 additions."
reopened: []
cancelled: null
---

**Goal:** `client.logger` offers the verification key, a paged listing and a verbatim download of audit-log files; operations that need mass-storage hardware fail with `HemUnsupportedError` where the device answers 404.

**Notes:**
- New module `src/api/logger.ts` (ARCHITECTURE.md §9), namespace
  `client.logger`, scope `logger:get` for all three; add its operations to
  `ALL_OPERATIONS` and the conformance tables.
- Key (`GET /api/logger/key`): `key` 32, `nonce` 32, `nonce_signed` 64
  bytes.
- List: one operation over `GET /api/logger/list` and `/list/{offset}`,
  as `keys.list` does; result `{ total, ids }`, ids 8 lower-case hex;
  negative or non-integer offset raises `HemValidationError`; TSDoc states
  that `total` counts the whole directory and that the operation needs
  mass-storage hardware.
- Download (`GET /api/logger/{file}`): the binding core parses JSON only
  (`parseResponse` in `src/api/core.ts`); add a raw-body path that returns
  the transport's bytes untouched plus a `text()` view — no line is parsed
  (quirk 15). File id not 8 hex chars raises `HemValidationError`; 406
  (file being written) raises `HemOperationFailedError`.
- REQ-API-011: a 404 from list or download raises `HemUnsupportedError`;
  for download the message names both causes (no mass storage, unknown
  file id). Mark the operation descriptions as mass-storage-only so the
  doc check (REQ-API-007 / `tests/support/doc-check.ts`) can require the
  hardware note in their TSDoc. The storage, attestation and upgrade cases
  of REQ-API-011 are M3A; tick only the audit-log criteria here.

**Definition of done**
- [x] Key: scope `logger:get`; result bytes of 32/32/64.
- [x] List: offset 0 and non-zero each build the right path; result
      `{ total, ids }`; bad offset raises `HemValidationError`; TSDoc notes
      `total` semantics and mass-storage hardware.
- [x] Download: bytes unmodified with a text view; bad file id raises
      `HemValidationError`; 406 raises `HemOperationFailedError`; TSDoc
      notes mass-storage hardware.
- [x] 404 from list or download raises `HemUnsupportedError`; the download
      message names both causes.
- [x] The doc check requires the mass-storage note for operations flagged
      so, and `client.logger` is covered by the operation-docs and
      conformance tests.
- [x] Each operation has unit tests asserting method, path, headers, body
      and response mapping (Node 24 and the browser run), and TSDoc stating
      scope and milestone (`Introduced in M2.`).
- [x] Each operation raises `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [x] `implements:` and `verifies:` tags exist for the REQs above; the
      non-`(M2B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
- [x] `npm run surface:update` adds entries only; `npm run check` passes.
