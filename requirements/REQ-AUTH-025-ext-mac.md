---
id: REQ-AUTH-025
title: Proof that the device holds its identity key
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Proof that the device holds its identity key

The library SHALL provide a call for `POST /api/auth/ext/mac` that takes a
32-byte public key and returns the device's nonce, MAC and identity key.

**Rationale:** The MAC is HMAC-SHA256 over the nonce, keyed with the ECDH
secret between the device identity key and the supplied key [YAML]; whoever
holds the matching private key can check that the device is the one it
claims to be. Introduced in M3.

**Acceptance criteria:**
- [ ] The body is `{epk}`; the scope used is `auth:ext:pair`; the result
      contains `nonce`, `mac` and `eid` as bytes.
- [ ] An `epk` that does not decode to 32 bytes raises `HemValidationError`.
- [ ] (M3B) the device's reply verifies against a locally generated key
      pair.
