---
id: REQ-OPS-015
title: ECDH-agreed keys for HMAC, cipher and wrap
status: verified
priority: must
revision: 2
source: start_point M2.1; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-OPS-001", "REQ-OPS-002", "REQ-OPS-003", "REQ-OPS-005", "REQ-OPS-008", "REQ-OPS-009"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ECDH-agreed keys for HMAC, cipher and wrap

The HMAC, cipher and wrap operations SHALL each accept, in addition to a
stored key alone, a key agreed by ECDH between the stored key and a peer
public key that is given either as a stored key id or as raw bytes.

On the wire the peer is `ext_kid` or `pubkey`, exactly one of them. The
device then derives the working key itself: for HMAC the raw ECDH secret is
the key and `alg` is required; for cipher and wrap the key comes from
HKDF-SHA256 with the info `encedo-aes` or `encedo-kek` followed by an
optional context of up to 64 bytes [YAML], [C-SDK].

**Rationale:** The reference offers these modes for every symmetric
operation. They let two parties who each hold a key on a device share a
working key without it ever being exported. Introduced in M2.

**Acceptance criteria:**
- [x] HMAC hash and verify, encrypt, decrypt, wrap and unwrap each accept a
      peer and send it as `ext_kid` or `pubkey` — optional `peer` (and
      `ctx`) on their parameters, STEP-M2A-040 (2026-10-27).
- [x] Giving both peer forms raises `HemValidationError`; so does HMAC in
      this mode without `alg`, and a context longer than 64 bytes — and,
      as library decisions, a context without a peer, a context on HMAC,
      and `alg` on HMAC with a stored key (the device ignores it, quirk 10).
- [x] The token scope remains `keymgmt:use:<kid>` of the primary key —
      tested per operation with a peer key id that differs from `kid`.
- [ ] (M2B) on the test device, encrypt with an agreed key followed by
      decrypt with the same pair returns the original message.
- [ ] (M2B) the HMAC from the device in this mode equals one computed
      locally from the ECDH secret.
