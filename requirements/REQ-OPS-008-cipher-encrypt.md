---
id: REQ-OPS-008
title: AES encryption
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

# AES encryption

The library SHALL provide a call for `POST /api/crypto/cipher/encrypt` that
encrypts a message with a stored AES key in ECB, CBC or GCM mode.

Algorithms [YAML]: `AES128`, `AES192` or `AES256`, each with `-ECB`, `-CBC`
or `-GCM`. The device always generates the 16-byte IV itself and returns it;
GCM also returns a 16-byte tag. CBC input is padded by the device; ECB input
has to be a multiple of 16 bytes.

**Rationale:** The IV cannot be supplied by the caller [YAML], so the result
has to carry everything decryption will need. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg, alg}` plus `aad` for GCM when given; the scope
      used is `keymgmt:use:<kid>`.
- [ ] The result contains the ciphertext, the IV for CBC and GCM, and the
      tag for GCM, all as bytes.
- [ ] An unknown algorithm, ECB input that is not a multiple of 16 bytes, or
      associated data given with a mode other than GCM, raises
      `HemValidationError`.
- [ ] (M2B) each of the three modes is run on the test device with an
      `AES256` key; the IV and tag lengths are recorded.
