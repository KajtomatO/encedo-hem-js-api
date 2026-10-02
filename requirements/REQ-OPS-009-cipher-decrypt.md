---
id: REQ-OPS-009
title: AES decryption
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

# AES decryption

The library SHALL provide a call for `POST /api/crypto/cipher/decrypt` that
decrypts a message with a stored AES key in ECB, CBC or GCM mode.

**Rationale:** The counterpart of encrypt; it takes back the IV and tag that
encrypt returned. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg, alg}` plus `iv`, `tag` and `aad` as the mode
      requires; the scope used is `keymgmt:use:<kid>`; the result is the
      plaintext as bytes.
- [ ] An IV or tag that is not exactly 16 bytes, or one missing where the
      mode requires it, raises `HemValidationError`.
- [ ] A 406 (decryption or authentication failure) raises
      `HemOperationFailedError`.
- [ ] (M2B) the outputs of REQ-OPS-008 decrypt on the test device to the
      original message; a GCM message with an altered tag fails.
