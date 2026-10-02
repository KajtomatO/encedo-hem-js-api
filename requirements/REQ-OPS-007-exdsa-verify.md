---
id: REQ-OPS-007
title: Verify an ECDSA or EdDSA signature
status: approved
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-OPS-004", "REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Verify an ECDSA or EdDSA signature

The library SHALL provide a call for `POST /api/crypto/exdsa/verify` that
checks a signature over a message with a stored key.

**Rationale:** Verification on the device completes the signing operation
for callers that hold no verification code of their own. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg, sign, alg}` plus `ctx` when given; the scope
      used is `keymgmt:use:<kid>`; the result follows REQ-OPS-004.
- [ ] (M2B) on the test device a signature from REQ-OPS-006 verifies as
      `true`, and one over a different message as `false`.
