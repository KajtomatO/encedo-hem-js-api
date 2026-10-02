---
id: REQ-SYS-004
title: Check-in step 1
status: draft
priority: must
revision: 1
source: start_point M1.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Check-in step 1

The library SHALL provide a call for `GET /api/system/checkin` that returns
the device-signed check-in token.

**Rationale:** Check-in is how the device's clock gets set and how the
vendor backend manages the device. The brief asks for its two device steps
to be exposed separately so the caller can relay the token itself.
Introduced in M1.

**Acceptance criteria:**
- [ ] No `Authorization` header is sent; the result is the `check` string,
      unmodified.
- [ ] A reply without `check` raises `HemProtocolError`.
- [ ] (M1B) the device returns a check-in token.
