---
id: REQ-OPS-005
title: Verify an HMAC
status: approved
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-OPS-004", "REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Verify an HMAC

The library SHALL provide a call for `POST /api/crypto/hmac/verify` that
checks a MAC over a message with a stored key.

**Rationale:** Letting the device compare the MAC avoids exposing the
expected value to the caller. Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, msg, mac}`; the scope used is `keymgmt:use:<kid>`;
      the result follows REQ-OPS-004.
- [ ] A MAC longer than 64 bytes raises `HemValidationError`.
- [ ] (M2B) on the test device a MAC from REQ-OPS-001 verifies as `true`,
      and an altered one as `false`.
