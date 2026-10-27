---
id: REQ-SYS-011
title: Audit-log download as raw content
status: verified
priority: must
revision: 2
source: start_point §4; start_point M2.3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Audit-log download as raw content

The library SHALL provide a call for `GET /api/logger/{file}` that returns
the content of one audit-log file exactly as the device sent it.

**Rationale:** Parsing log lines and verifying the integrity chain are the
caller's job. The chain is computed over the exact bytes, so the library
must not re-encode or parse them. The files are pipe-delimited text [C-SDK].
Introduced in M2.

**Acceptance criteria:**
- [x] The scope used is `logger:get` — `logger.download(fileId)`,
      STEP-M2A-070 (2026-10-27).
- [x] The result gives the body bytes unmodified and offers a text view of
      them; no line is parsed — `LogFile { id, bytes, contentType?, text() }`
      through the new raw-response path `invokeRaw` of the binding core.
- [x] A file id that is not 8 hex characters raises `HemValidationError`
      (upper-case ids are accepted and sent in lower case).
- [x] A 406 (file currently being written) raises `HemOperationFailedError`.
- [x] The documentation states that the operation needs mass-storage
      hardware — TSDoc of `logger.download`, checked by the operation-docs
      test.
- [ ] (M2B) a log file is downloaded from the test device; its content type
      and a sample of its format are recorded.
