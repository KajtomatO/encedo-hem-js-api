---
id: REQ-KEY-002
title: Read one key
status: approved
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Read one key

The library SHALL provide a call for `GET /api/keymgmt/get/{kid}` that
returns a key's type, public material and description as far as the device
provides them.

**Rationale:** A consumer reads a key to learn its type and, for asymmetric
keys, its public key. Private material is never returned [YAML]. On firmware
1.2.2 the reply contains neither the label nor, in practice, the description
[C-SDK]; those come from list or search. Introduced in M1.

**Acceptance criteria:**
- [ ] The scope used is `keymgmt:use:<kid>`.
- [ ] The result contains `updated`, and `type`, `pubkey` (bytes), `der`
      (bytes) and `descr` (bytes) when present.
- [ ] A 406 (key not found) raises `HemOperationFailedError`.
- [ ] The documentation states the public-key formats — compressed X9.63 for
      the `SECP*` types, raw for the others [YAML] — and that label and
      description are read through list or search.
- [ ] (M1B) a created key is read back; which fields the test device returns
      is recorded.
