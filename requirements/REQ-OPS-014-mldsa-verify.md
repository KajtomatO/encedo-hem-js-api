---
id: REQ-OPS-014
title: Verify an ML-DSA signature
status: draft
priority: must
revision: 1
source: start_point §4; start_point G16; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-OPS-004", "REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Verify an ML-DSA signature

The library SHALL provide a call for `POST /api/crypto/pqc/mldsa/verify`
that checks an ML-DSA signature and treats every completed response that is
neither a success nor an authentication or authorisation failure as an
invalid signature.

**Rationale:** On a failed verification the firmware puts a raw internal
error code into the HTTP status line instead of 406: the reference mentions
100, and 795 was observed [YAML], [C-SDK]. Verification also needs the
device-generated private-key object; an imported public-only key is rejected
[YAML]. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg, sign}` plus `ctx` when given; the scope used
      is `keymgmt:use:<kid>`.
- [ ] 200 gives `true`; 401 and 403 raise their error classes; any other
      completed status, standard or not, gives `false`.
- [ ] A request whose JSON body would exceed 7300 bytes raises
      `HemValidationError` (an ML-DSA-87 signature leaves room for roughly
      800 message bytes).
- [ ] (M2B) on the test device a good signature gives `true`.
- [ ] (M2B) a bad signature is sent and what `fetch` reports in Node 24 — a
      response with an unusual status, an error, or a hang — is recorded;
      the mapping to `false` is confirmed or revised accordingly
      (ARCHITECTURE.md §11, risk 2).
