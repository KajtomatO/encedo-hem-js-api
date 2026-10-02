---
id: REQ-OPS-010
title: ECDH shared secret
status: approved
priority: must
revision: 1
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
- [ ] The body is `{kid}` plus exactly one of `ext_kid` or `pubkey`, and
      `alg` when given; the scope used is `keymgmt:use:<kid>`; the result is
      the secret as bytes.
- [ ] Giving both peers or neither raises `HemValidationError`.
- [ ] The documentation states the truncation of the raw secret.
- [ ] (M2B) for an X25519 key on the test device and a locally generated
      peer, the device's raw secret equals the one computed locally with Web
      Crypto.
- [ ] (M2B) the raw output length for a P-384 key is recorded.
