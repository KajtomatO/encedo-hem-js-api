---
id: REQ-OPS-013
title: ML-DSA signature
status: draft
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ML-DSA signature

The library SHALL provide a call for `POST /api/crypto/pqc/mldsa/sign` that
signs a message with a stored ML-DSA key.

**Rationale:** Signatures are 2420, 3309 or 4627 bytes for ML-DSA-44, -65
and -87; an optional context of up to 255 bytes is supported [YAML].
Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg}` plus `ctx` when given; the scope used is
      `keymgmt:use:<kid>`; the result contains the parameter-set name and
      the signature as bytes.
- [ ] A context longer than 255 bytes raises `HemValidationError`.
- [ ] (M2B) a signature is made on the test device with an `MLDSA65` key;
      its length is recorded.
