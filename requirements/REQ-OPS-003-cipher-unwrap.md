---
id: REQ-OPS-003
title: AES key unwrap
status: verified
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-NET-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# AES key unwrap

The library SHALL provide a call for `POST /api/crypto/cipher/unwrap` that
unwraps key material with a stored AES key.

**Rationale:** The counterpart of wrap: the consumer gets its data key back
from the stored wrapped form. Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{kid, msg}` plus `alg` and `iv` when given; the scope
      used is `keymgmt:use:<kid>`; the result is the unwrapped bytes.
- [ ] Input that is not a multiple of 8 bytes raises `HemValidationError`.
- [ ] A 406 (integrity check failed or wrong key) raises
      `HemOperationFailedError`.
- [ ] (M1B) unwrapping the output of REQ-OPS-002 on the test device returns
      the original 32 bytes; unwrapping altered input fails.
