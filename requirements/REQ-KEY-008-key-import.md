---
id: REQ-KEY-008
title: Import an external public key
status: needs-reverify
priority: must
revision: 4
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
others. For a `SECP*` type the library sends `mode: ECDH` when the caller
gives no mode.

**Rationale:** A stored peer public key can be named by its key id in
ECDH-based operations. The key id is computed from the key material, so
importing the same key twice is refused with 406 [YAML], [C-SDK]. A `SECP*`
public key imported without `mode` cannot serve as an ECDH peer (device,
2026-10-27, STEP-M2B-040), so the library defaults the mode to `ECDH` as
key create does (user decision 2026-10-27, §6.2 impact analysis at
STEP-M2B-075; revision 4). Introduced in M2.

**Acceptance criteria:**
- [x] The body is `{label, pubkey, type}` plus `descr` when given, and
      `mode` for a `SECP*` type — the caller's, else `ECDH` — and never for
      another type; the scope used is `keymgmt:imp`; the result is the key
      id — STEP-M2B-075 (2026-10-27), unit-tested over all 14 types.
- [x] A symmetric type raises `HemValidationError` — `IMPORTABLE_KEY_TYPES`
      holds the 14 asymmetric types of the reference.
- [x] The library applies no size limit of its own to the public key beyond
      the JSON body limit (an 800-byte ML-KEM key imports [C-SDK]) — unit
      test sends an 800-byte key.
- [x] A 406 raises `HemOperationFailedError` whose message names a duplicate
      key among the possible causes.
- [x] (M2B) a freshly generated X25519 public key is imported, and a second
      import of it is refused — live 2026-10-27 (STEP-M2B-010): imported
      as type `ECDH,CURVE25519` (no `PKEY` flag: public only); `keys.get`
      returned the same 32 bytes; the second import → 406.
- [x] (M2B) a local P-256 public key imported without `mode` serves as the
      stored peer (`extKid`) of an ECDH — live 2026-10-27 (STEP-M2B-075):
      listed as `ECDH,SECP256R1`; the secret equals the one computed with
      the same key given raw (tests/integration/keys-secp-mode.test.ts).
