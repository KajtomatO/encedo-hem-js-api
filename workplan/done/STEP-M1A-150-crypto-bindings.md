---
id: STEP-M1A-150
title: Crypto bindings — HMAC, wrap, unwrap
milestone: M1A
implements: ["REQ-OPS-001", "REQ-OPS-002", "REQ-OPS-003", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-060", "STEP-M1A-100"]
evidence:
  commits: ["670db02"]
  tests: ["verifies: REQ-OPS-001", "verifies: REQ-OPS-002", "verifies: REQ-OPS-003", "verifies: REQ-API-005", "verifies: REQ-NET-003", "verifies: REQ-AUTH-005"]
  notes: "npm run check: 391 passed in Node 24 and headless Chromium. client.crypto.hmac/wrap/unwrap, stored-key mode only (ECDH modes are M2A). Unwrap input must be a non-empty multiple of 8 bytes; its upper size bound is the 7300-byte body limit."
reopened: []
cancelled: null
---

**Goal:** `client.crypto.hmac`, `wrap` and `unwrap` with scope
`keymgmt:use:<kid>`, input validation before sending, `requiresTls`, and
tested request and response shapes.

**Notes:** HMAC: body `{kid, msg}` with no `alg` (quirk 10); message 1 to
2048 bytes; 406 is `HemOperationFailedError`. Wrap: body `{kid, msg}` plus
`alg` (`AES128`, `AES192`, `AES256`) and `iv` when given; message a
multiple of 8 bytes, at least 16 and at most 2048; `iv` 8 bytes; violations
raise `HemValidationError` (the device answers 406 for these [C-SDK]).
Unwrap: same body; message a multiple of 8 bytes; 406 is
`HemOperationFailedError`. All results are bytes.

**Definition of done**
- [x] HMAC: body `{kid, msg}` in base64 and no `alg`; scope `keymgmt:use:<kid>`; result is the MAC as bytes; an empty or over-2048-byte message raises `HemValidationError`; 406 raises `HemOperationFailedError`
- [x] Wrap: body with `alg` and `iv` when given; scope; result bytes; input not a multiple of 8, under 16 or over 2048 bytes, or an `iv` that is not 8 bytes, raises `HemValidationError`
- [x] Unwrap: body with `alg` and `iv` when given; input not a multiple of 8 bytes raises `HemValidationError`; 406 raises `HemOperationFailedError`
- [x] Every operation on an `http:` client raises `HemTlsRequiredError` with zero `fetch` calls
- [x] Each operation is documented with scope `keymgmt:use:<kid>` and milestone M1
