---
id: REQ-OPS-013
title: ML-DSA signature
status: verified
priority: must
revision: 3
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
- [x] The body is `{kid, msg}` plus `ctx` when given; the scope used is
      `keymgmt:use:<kid>`; the result contains the parameter-set name and
      the signature as bytes — `crypto.mldsaSign` → `{ alg, signature }`,
      STEP-M2A-050 (2026-10-27).
- [x] A context longer than 255 bytes raises `HemValidationError`.
- [x] (M2B) a signature is made on the test device with an `MLDSA65` key;
      its length is recorded — live 2026-10-27 (STEP-M2B-050): 3309 bytes,
      `alg` `MLDSA65`; with a context also 3309 bytes, and that signature
      verifies only with the same context; key generation took 0.3 s.
