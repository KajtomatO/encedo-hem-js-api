---
id: REQ-SYS-028
title: Device shutdown
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.2; start_point M3.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-012", "REQ-API-013", "REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Device shutdown

The library SHALL provide a dedicated call for `GET /api/system/shutdown`
that shuts the device down.

**Rationale:** After a shutdown the device stops responding until someone
physically power-cycles it [YAML]. It is a call of its own (REQ-API-012).
Introduced in M3.

**Acceptance criteria:**
- [ ] The scope used is `system:shutdown`; a token is always sent.
- [ ] A dropped connection after the request is handled per REQ-API-013.
- [ ] A 409 (install in progress) raises `HemDeviceStateError`.
- [ ] (M3B) attended and disruptive: exercised only if the user decides to,
      as the last action of a session.
