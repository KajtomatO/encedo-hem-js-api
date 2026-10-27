---
id: REQ-OPS-006
title: ECDSA and EdDSA signature
status: verified
priority: must
revision: 2
source: start_point §4; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ECDSA and EdDSA signature

The library SHALL provide a call for `POST /api/crypto/exdsa/sign` that
signs a message with a stored private key.

Algorithms [YAML]: `SHA256WithECDSA`, `SHA384WithECDSA`, `SHA512WithECDSA`
for `SECP*` keys; `Ed25519`, `Ed25519ph`, `Ed25519ctx` for `ED25519`;
`Ed448`, `Ed448ph` for `ED448`. A context of up to 255 bytes applies to the
`ph` and `ctx` variants only.

**Rationale:** The device hashes the message itself, so the caller sends the
message, not a digest. ECDSA signatures come back DER-encoded, EdDSA
signatures raw [C-SDK]. Introduced in M2.

**Acceptance criteria:**
- [x] The body is `{kid, msg, alg}` plus `ctx` when given; the scope used is
      `keymgmt:use:<kid>`; the result is the signature as bytes —
      `crypto.sign`, STEP-M2A-020 (2026-10-27).
- [x] An algorithm outside the list, or a context longer than 255 bytes,
      raises `HemValidationError` — as does a context given with an
      algorithm that takes none (`Ed25519`, `*WithECDSA`), a library
      decision so a context is never silently dropped.
- [x] The documentation states the signature encoding per key family and
      that a `SECP*` key needs the `ExDSA` mode to sign — TSDoc of
      `crypto.sign`.
- [ ] (M2B) signatures made on the test device with a P-256 key and an
      Ed25519 key verify locally with Web Crypto; the ECDSA encoding is
      recorded.
