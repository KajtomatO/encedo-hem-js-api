---
id: REQ-OPS-011
title: ML-KEM encapsulation
status: approved
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# ML-KEM encapsulation

The library SHALL provide a call for `POST /api/crypto/pqc/mlkem/encaps`
that returns a shared secret and its ciphertext for a stored ML-KEM key.

**Rationale:** The ciphertext is 768, 1088 or 1568 bytes for ML-KEM-512,
-768 and -1024; the shared secret is 32 bytes [YAML]. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid}`; the scope used is `keymgmt:use:<kid>`; the result
      contains the parameter-set name, the shared secret and the ciphertext
      as bytes.
- [ ] A 406 (key missing or not an ML-KEM private key) raises
      `HemOperationFailedError`.
- [ ] (M2B) encapsulation runs on the test device for an `MLKEM768` key; the
      lengths are recorded.
