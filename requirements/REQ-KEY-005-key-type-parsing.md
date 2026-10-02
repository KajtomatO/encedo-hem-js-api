---
id: REQ-KEY-005
title: Key type presented as flags and algorithm
status: draft
priority: must
revision: 1
source: ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Key type presented as flags and algorithm

The library SHALL present a key's `type` string as a set of attribute flags
plus an algorithm name.

**Rationale:** List and search return the type as comma-joined tokens such
as `PKEY,ECDH,ExDSA,SECP256R1` [YAML]. Callers need to ask "can this key
sign" without parsing strings. Key get returns a bare algorithm name for
asymmetric keys [C-SDK], so both forms have to parse. Introduced in M1.

**Acceptance criteria:**
- [ ] The flags `ATT`, `PKEY`, `ECDH`, `ExDSA`, `CERT` and `PQC` and every
      algorithm name of the reference are recognised.
- [ ] A bare algorithm name parses to that algorithm with no flags.
- [ ] An unknown token does not raise an error; the original string stays
      available.
- [ ] (M1B) the type strings of every key on the test device parse; any
      token not in the reference is recorded.
