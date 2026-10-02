---
id: REQ-AUTH-015
title: Mobile approval step 2 — redeem the reply
status: verified
priority: must
revision: 1
source: start_point M1.2; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-004", "REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
---

# Mobile approval step 2 — redeem the reply

The library SHALL provide a call for `POST /api/auth/ext/token` that redeems
a mobile app's reply for a bearer token.

**Rationale:** This is the second device step of mobile approval; like the
first it needs no token [YAML]. Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{authreply}`; no `Authorization` header is sent; the
      result is the token.
- [ ] The token is cached under the scope that was originally requested,
      with the expiry taken from its `exp` claim.
- [ ] A 401 (reply invalid, expired or already used) raises
      `HemUnauthenticatedError`; a 406 (unknown pairing or undecryptable
      scope) raises `HemOperationFailedError`.
- [ ] (M1B) attended: a token obtained through approval on the real phone is
      accepted by the device; its lifetime is recorded ([C-SDK] observed 15
      minutes with the Encedo app).
