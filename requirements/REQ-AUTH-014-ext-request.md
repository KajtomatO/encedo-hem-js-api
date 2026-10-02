---
id: REQ-AUTH-014
title: Mobile approval step 1 — authorization request
status: approved
priority: must
revision: 1
source: start_point M1.2; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
---

# Mobile approval step 1 — authorization request

The library SHALL provide a call for `POST /api/auth/ext/request` that takes
the relay-provided public key, a scope and an optional context and note, and
returns the device's authorization request.

**Rationale:** This is the first of the two device steps of mobile approval.
It needs no token [YAML]. What it returns is opaque to the client and is
meant for the paired apps. Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{epk, scope}` plus `ctx` and `note` when given; no
      `Authorization` header is sent; the result is `{authreq, epk}` as
      opaque strings.
- [ ] `HemValidationError` is raised when `epk` does not decode to 32 bytes,
      the scope exceeds 1023 characters, `ctx` is not 1 to 64 characters or
      `note` is not 1 to 128 characters (the firmware silently drops
      out-of-range values [C-SDK]).
- [ ] A 403 (clock not set) leads to the same single check-in recovery as a
      login (REQ-AUTH-009).
- [ ] (M1B) the device returns an authorization request for the scope
      `keymgmt:list`.
