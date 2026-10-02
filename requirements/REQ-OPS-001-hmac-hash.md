---
id: REQ-OPS-001
title: HMAC with a stored key
status: verified
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# HMAC with a stored key

The library SHALL provide a call for `POST /api/crypto/hmac/hash` that
returns the HMAC of a message computed with a stored key.

**Rationale:** This is how the consumer derives data keys from a root key
that never leaves the device. The hash is fixed by the key's type; an `alg`
field sent with a stored key is ignored [YAML], [C-SDK]. Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{kid, msg}` with the message in base64 and no `alg`; the
      scope used is `keymgmt:use:<kid>`; the result is the MAC as bytes.
- [ ] An empty message, or one longer than 2048 bytes, raises
      `HemValidationError`.
- [ ] A 406 (key not found or wrong key type) raises
      `HemOperationFailedError`.
- [ ] (M1B) the HMAC returned by the test device for a `SHA2-256` key is 32
      bytes long and is the same for the same message twice.
