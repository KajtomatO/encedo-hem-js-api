---
id: REQ-OPS-002
title: AES key wrap
status: draft
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# AES key wrap

The library SHALL provide a call for `POST /api/crypto/cipher/wrap` that
wraps key material with a stored AES key.

**Rationale:** Envelope encryption: the consumer generates a data key, has
the device wrap it, and stores only the wrapped form. The device implements
RFC 3394 key wrap; the output is 8 bytes longer than the input [YAML].
Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{kid, msg}` plus `alg` (`AES128`, `AES192` or `AES256`)
      and `iv` when given; the scope used is `keymgmt:use:<kid>`; the result
      is the wrapped bytes.
- [ ] Input that is not a multiple of 8 bytes, shorter than 16 bytes or
      longer than 2048 bytes, or an `iv` that is not 8 bytes, raises
      `HemValidationError` (the device answers 406 for these [C-SDK]).
- [ ] (M1B) a 32-byte key is wrapped by the test device and the result is 40
      bytes.
