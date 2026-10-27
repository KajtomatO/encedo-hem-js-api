---
id: REQ-OPS-010
title: ECDH shared secret
status: verified
priority: must
revision: 3
source: start_point §4; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ECDH shared secret

The library SHALL provide a call for `POST /api/crypto/ecdh` that returns
the shared secret between a stored private key and a peer public key.

**Rationale:** The peer is a stored key id or raw public-key bytes. With a
hash `alg` the device returns the digest of the secret (32, 48 or 64 bytes).
Without one it returns the raw secret, truncated to 32 bytes even for larger
curves [C-SDK]. Introduced in M2.

**Acceptance criteria:**
- [x] The body is `{kid}` plus exactly one of `ext_kid` or `pubkey`, and
      `alg` when given; the scope used is `keymgmt:use:<kid>`; the result is
      the secret as bytes — `crypto.ecdh`, STEP-M2A-040 (2026-10-27).
- [x] Giving both peers or neither raises `HemValidationError` (the shared
      `peer: { extKid } | { pubkey }` parameter of `src/api/peer.ts`).
- [x] The documentation states the truncation of the raw secret — TSDoc of
      `crypto.ecdh`.
- [x] (M2B) for an X25519 key on the test device and a locally generated
      peer, the device's raw secret equals the one computed locally with Web
      Crypto — live 2026-10-27 (STEP-M2B-040): equal, 32 bytes; with
      `alg: SHA2-384` the device returns the 48-byte digest of that secret;
      the same secret through the peer imported as a stored key.
- [x] (M2B) the raw output length for a P-384 key is recorded — live
      2026-10-27: 32 bytes for P-384 and for Curve448 (quirk 9 confirmed).
      Findings on the way: a `SECP*` key created *without* `mode` carries
      no `ECDH` flag on firmware 1.2.2-DIAG and every ECDH with it is 406
      (quirk 11 corrected); a `SECP*` peer given raw must be compressed
      X9.63 (uncompressed → 406); a `SECP*` peer imported without `mode`
      cannot serve as `ext_kid` either (406).
