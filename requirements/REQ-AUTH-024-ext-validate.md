---
id: REQ-AUTH-024
title: Mobile-app pairing step 2
status: approved
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Mobile-app pairing step 2

The library SHALL provide a call for `POST /api/auth/ext/validate` that
submits the app's pairing reply and returns the new pairing's key id and
confirmation code.

**Rationale:** This is where the device stores the app's key. Up to 8 apps
can be paired [YAML]; a full table and an already-paired app both answer 406
and cannot be told apart [C-SDK]. Introduced in M3.

**Acceptance criteria:**
- [ ] The body is `{pid, reply}`; the scope used is `auth:ext:pair`; the
      result is `{kid, code}`.
- [ ] A `pid` that does not decode to 32 bytes raises `HemValidationError`.
- [ ] A 406 raises `HemOperationFailedError` whose message names both
      possible causes.
- [ ] (M3B) attended: a real phone is paired and appears in the key list.
