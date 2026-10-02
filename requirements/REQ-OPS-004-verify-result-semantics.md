---
id: REQ-OPS-004
title: Verify operations return valid or invalid
status: draft
priority: must
revision: 1
source: start_point M2.2; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Verify operations return valid or invalid

A verify operation SHALL return `false` when the device reports that the
signature or MAC does not match, and raise an error only for other failures.

**Rationale:** An invalid signature is an answer, not a malfunction. The
device reports a mismatch with 406, the same status it uses for a missing
key or a wrong key type; the cases cannot be told apart [C-SDK], so `false`
can also mean the key was unusable for the check. Introduced in M2.

**Acceptance criteria:**
- [ ] For each verify operation: 200 gives `true`; the device's mismatch
      response gives `false`.
- [ ] 400, 401, 403, 409 and transport failures raise their error classes.
- [ ] The documentation of each verify operation states that `false` also
      covers a missing or unsuitable key.
