---
id: STEP-M1A-030
title: Error classes and status mapping
milestone: M1A
implements: ["REQ-API-002", "REQ-API-003"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1A-010"]
evidence:
  commits: ["19ffce3"]
  tests: ["verifies: REQ-API-002", "verifies: REQ-API-003"]
  notes: "npm run check: 72 tests passed in Node 24 and Chromium. Added HemRelayError (code RELAY) for cloud-relay statuses other than the expected ones (REQ-SYS-006, REQ-AUTH-017 need an error carrying status and body); it is additive to the §4 list. The (M1B) device criteria stay open."
reopened: []
cancelled: null
---

**Goal:** `src/errors.ts` defines `HemError` and every subclass of
ARCHITECTURE.md §4, plus a mapping from an HTTP response (status, headers,
body text) to an error instance that never requires a body.

**Notes:** Classes: `HemBadRequestError` 400, `HemUnauthenticatedError`
401, `HemForbiddenError` 403, `HemOperationFailedError` 406,
`HemDeviceStateError` 409, `HemOriginRejectedError` 412,
`HemPayloadTooLargeError` 413, `HemTlsRequiredError` 418, `HemDeviceError`
(500 and any other unexpected status), `HemTimeoutError`,
`HemUnreachableError`, `HemAbortError`, `HemValidationError`,
`HemProtocolError`, `HemUnsupportedError`, `HemApprovalRejectedError`,
`HemApprovalTimeoutError`. The base carries `code`, `status`, `operation`
and `cause`; the body is exposed as raw text and, when it parses, as JSON.
The transport classes are defined here and raised in STEP-M1A-050; the
one-retry semantics of 401 belong to STEP-M1A-100.

**Definition of done**
- [x] A table-driven test maps each listed status to its own class; 404, 410 and 411 map to `HemDeviceError` with the raw status preserved
- [x] All classes extend one exported base with a stable `code`, the HTTP `status` when a response exists, and the operation name; `instanceof` works
- [x] An empty body with `Content-Type: application/json` maps to its class with no parse exception
- [x] A non-JSON body maps to its class with the raw text available; a JSON body is exposed parsed
- [x] All classes are exported from the package root
