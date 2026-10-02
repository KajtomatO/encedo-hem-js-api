---
id: REQ-KEY-008
title: Import an external public key
status: approved
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Import an external public key

The library SHALL provide a call for `POST /api/keymgmt/import` that stores
an external public key and returns its key id.

Importable types [YAML]: the `SECP*`, `CURVE*`, `ED*`, `MLKEM*` and `MLDSA*`
types. The key is given compressed (X9.63) for `SECP*` and raw for the
others.

**Rationale:** A stored peer public key can be named by its key id in
ECDH-based operations. The key id is computed from the key material, so
importing the same key twice is refused with 406 [YAML], [C-SDK]. Introduced
in M2.

**Acceptance criteria:**
- [ ] The body is `{label, pubkey, type}` plus `mode` and `descr` when
      given; the scope used is `keymgmt:imp`; the result is the key id.
- [ ] A symmetric type raises `HemValidationError`.
- [ ] The library applies no size limit of its own to the public key beyond
      the JSON body limit (an 800-byte ML-KEM key imports [C-SDK]).
- [ ] A 406 raises `HemOperationFailedError` whose message names a duplicate
      key among the possible causes.
- [ ] (M2B) a freshly generated X25519 public key is imported, and a second
      import of it is refused.
