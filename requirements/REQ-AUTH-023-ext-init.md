---
id: REQ-AUTH-023
title: Mobile-app pairing step 1
status: approved
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Mobile-app pairing step 1

The library SHALL provide a call for `POST /api/auth/ext/init` that takes a
32-byte public key and returns the device's pairing request.

**Rationale:** Pairing a phone starts here. The device requires a user-role
token with scope `auth:ext:pair` [YAML]. Introduced in M3.

**Acceptance criteria:**
- [ ] The body is `{epk}`; the scope used is `auth:ext:pair`; the result is
      `{request, eid}`.
- [ ] An `epk` that does not decode to 32 bytes raises `HemValidationError`.
- [ ] On a mobile-mode client the call fails without sending a push, since
      the device demands the user role [C-SDK].
- [ ] (M3B) attended: the device returns a pairing request.
