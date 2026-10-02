---
id: REQ-KEY-001
title: Generate a key on the device
status: approved
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Generate a key on the device

The library SHALL provide a call for `POST /api/keymgmt/create` that
generates a key of a given type with a label and an optional description,
and returns its key id.

Key types [YAML]: `SECP256R1`, `SECP384R1`, `SECP521R1`, `SECP256K1`,
`CURVE25519`, `CURVE448`, `ED25519`, `ED448`, `SHA2-256`, `SHA2-384`,
`SHA2-512`, `SHA3-256`, `SHA3-384`, `SHA3-512`, `AES128`, `AES192`,
`AES256`, `MLKEM512`, `MLKEM768`, `MLKEM1024`, `MLDSA44`, `MLDSA65`,
`MLDSA87`. The `SHA*` types are HMAC keys. The optional `mode` — `ECDH`,
`ExDSA` or `ECDH,ExDSA` — applies to the `SECP*` types only.

**Rationale:** The consumer creates its root keys on the device so that they
never exist outside it. Two details matter in practice: a `SECP*` key is
created ECDH-only unless the mode asks for `ExDSA`, and then cannot sign;
and the mode literals are exact — `ExDSA,ECDH` is rejected [C-SDK].
Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{label, type}` plus `mode` and `descr` (base64) when
      given; the scope used is `keymgmt:gen`; the result is the key id.
- [ ] A type outside the list, or a mode outside the three literals, raises
      `HemValidationError`.
- [ ] Label and description limits are enforced per REQ-API-005.
- [ ] The documentation states the default mode of `SECP*` keys.
- [ ] (M1B) an `AES256` key and a `SHA2-256` key are created on the test
      device and appear in the list.
