---
id: REQ-SYS-009
title: Audit-log verification key
status: draft
priority: must
revision: 1
source: start_point §4; start_point M2.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-004"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Audit-log verification key

The library SHALL provide a call for `GET /api/logger/key` that returns the
audit-log verification key and the signed nonce.

**Rationale:** A caller that wants to verify the integrity of downloaded
audit logs needs this key material. The verification itself is left to the
caller. Introduced in M2.

**Acceptance criteria:**
- [ ] The scope used is `logger:get`.
- [ ] The result contains `key` (32 bytes), `nonce` (32 bytes) and
      `nonce_signed` (64 bytes) as bytes.
- [ ] (M2B) the device returns key material of those lengths.
