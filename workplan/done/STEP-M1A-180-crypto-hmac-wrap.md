---
id: STEP-M1A-180
title: HMAC, wrap, unwrap
milestone: M1A
implements: ["REQ-OPS-001", "REQ-OPS-002", "REQ-OPS-003"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-130"]
evidence:
  commits: ["92fa3ac"]
  tests: ["verifies: REQ-OPS-001 (tests/unit/crypto.test.ts)", "verifies: REQ-OPS-002 (tests/unit/crypto.test.ts)", "verifies: REQ-OPS-003 (tests/unit/crypto.test.ts)"]
  notes: "npm run check: 42 files, 872 tests passed in Node v24.21.0 and headless Chromium. Response fields from the reference: mac, wrapped, unwrapped. Unwrap input must be a non-empty multiple of 8 bytes (no upper bound beyond the 7300-byte body limit: the reference states none). With this step every validator of REQ-API-005 has been shown through a binding to make zero fetch calls (key id and label/description in keys tests, message here, body size in the binding-core tests), so that criterion is ticked; so is REQ-AUTH-005's per-key scope for key get and the crypto operations."
reopened: []
cancelled: null
---

**Goal:** `client.crypto` offers HMAC with a stored key, AES key wrap and AES
key unwrap, each with its own per-key token and its inputs checked before
anything is sent.

**Notes:**
- `src/api/crypto.ts`. All three use the exact scope `keymgmt:use:<kid>`
  [YAML] and are TLS-only (REQ-NET-003).
- HMAC: `POST /api/crypto/hmac/hash`. With a stored key the `alg` field is
  ignored and the key's type decides the hash [YAML], [C-SDK]
  (ARCHITECTURE.md §6 quirk 10), so `alg` is not sent.
- Wrap: `POST /api/crypto/cipher/wrap`; unwrap: `POST
  /api/crypto/cipher/unwrap`. The length rules of REQ-OPS-002 and
  REQ-OPS-003 are checked before sending; the device answers 406 for them
  [C-SDK].
- Take the response field names from `ref/api/hem-api-1.2.2.yaml` when
  implementing; the REQs name only what the result is.

**Definition of done**
- [x] HMAC: the body is `{kid, msg}` with the message in base64 and no `alg`;
      the scope used is `keymgmt:use:<kid>`; the result is the MAC as bytes.
- [x] HMAC: an empty message, or one longer than 2048 bytes, raises
      `HemValidationError`; a 406 raises `HemOperationFailedError`.
- [x] Wrap: the body is `{kid, msg}` plus `alg` (`AES128`, `AES192` or
      `AES256`) and `iv` when given; the scope used is `keymgmt:use:<kid>`;
      the result is the wrapped bytes.
- [x] Wrap: input that is not a multiple of 8 bytes, shorter than 16 bytes or
      longer than 2048 bytes, or an `iv` that is not 8 bytes, raises
      `HemValidationError`.
- [x] Unwrap: the body is `{kid, msg}` plus `alg` and `iv` when given; the
      scope used is `keymgmt:use:<kid>`; the result is the unwrapped bytes.
- [x] Unwrap: input that is not a multiple of 8 bytes raises
      `HemValidationError`; a 406 raises `HemOperationFailedError`.
- [x] All three raise `HemTlsRequiredError` on an `http:` client with zero
      `fetch` calls.
- [x] Each operation has unit tests asserting method, path, headers, body and
      response mapping, and TSDoc stating scope and milestone.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
