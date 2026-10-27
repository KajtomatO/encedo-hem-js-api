---
id: REQ-OPS-012
title: ML-KEM decapsulation
status: verified
priority: must
revision: 2
source: start_point §4; start_point G16; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ML-KEM decapsulation

The library SHALL provide a call for `POST /api/crypto/pqc/mlkem/decaps`
that returns the shared secret for a ciphertext and a stored ML-KEM key,
without exposing the response's `alg` field.

**Rationale:** The `alg` field of this response does not contain the
parameter-set name: the firmware returns an unrelated internal string there
[YAML], [C-SDK]. Passing it on would invite callers to rely on it.
Introduced in M2.

**Acceptance criteria:**
- [x] The body is `{kid, ct}`; the scope used is `keymgmt:use:<kid>`; the
      result is the 32-byte shared secret — `crypto.mlkemDecaps`,
      STEP-M2A-050 (2026-10-27).
- [x] A ciphertext whose length is none of 768, 1088 or 1568 bytes raises
      `HemValidationError`.
- [x] The result has no algorithm field, whatever the response contains —
      the result is the bare secret; `alg` is not even required in the
      reply.
- [ ] (M2B) on the test device the secret from decapsulation equals the one
      from REQ-OPS-011; the content of the `alg` field is recorded.
