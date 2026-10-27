---
id: REQ-KEY-001
title: Generate a key on the device
status: needs-reverify
priority: must
revision: 6
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
`ExDSA` or `ECDH,ExDSA` — applies to the `SECP*` types only; for a `SECP*`
type the library sends `ECDH` when the caller gives no mode.

**Rationale:** The consumer creates its root keys on the device so that they
never exist outside it. Two details matter in practice: a `SECP*` key needs
an explicit `mode` — [C-SDK] recorded "ECDH-only" as the default, but on the
test device (firmware 1.2.2-DIAG, 2026-10-27, STEP-M2B-040) a `SECP*` key
created without `mode` carries no usage flag and can neither sign nor run
ECDH (406); and the mode literals are exact — `ExDSA,ECDH` is rejected
[C-SDK]. Because such a key is unusable, the library supplies `ECDH` as
the default for `SECP*` types (user decision 2026-10-27, §6.2 impact
analysis at STEP-M2B-075; revision 6). Introduced in M1.

**Acceptance criteria:**
- [x] The body is `{label, type}` plus `descr` (base64) when given, and
      `mode` for a `SECP*` type — the caller's, else `ECDH` — and never for
      another type; the scope used is `keymgmt:gen`; the result is the key
      id — STEP-M2B-075 (2026-10-27), unit-tested over all 23 types.
- [x] A type outside the list, or a mode outside the three literals, raises
      `HemValidationError`.
- [x] Label and description limits are enforced per REQ-API-005.
- [x] The documentation states the default mode of `SECP*` keys: `ECDH`,
      supplied by the library because the device applies none — TSDoc of
      `keys.create` and `CreateKeyParams.mode`, README, quirk 11.
- [x] (M1B) an `AES256` key and a `SHA2-256` key are created on the test
      device and appear in the list — 2026-10-09: listed with the types
      `ATT,AES256` and `ATT,SHA2-256` (tests/integration/keys.test.ts).
- [x] (M2B) a `SECP256R1` key created without `mode` is listed with the
      `ECDH` flag and completes an ECDH — live 2026-10-27 (STEP-M2B-075):
      listed as `ATT,PKEY,ECDH,SECP256R1`, 32-byte secret against a local
      P-256 peer; with `mode: ExDSA` the key is `ATT,PKEY,ExDSA,SECP256R1`
      (tests/integration/keys-secp-mode.test.ts).
