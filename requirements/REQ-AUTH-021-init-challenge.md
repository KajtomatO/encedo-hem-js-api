---
id: REQ-AUTH-021
title: Provisioning challenge
status: approved
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#5-auth--session"]
---

# Provisioning challenge

The library SHALL provide a call for `GET /api/auth/init` that returns the
provisioning challenge of a factory-fresh device.

**Rationale:** Provisioning starts with this challenge, which exists only
while the device is uninitialised [YAML]. Introduced in M3.

**Acceptance criteria:**
- [ ] The result contains `exp`, `spk`, `jti`, `genuine` and `eid`; no
      `Authorization` header is sent.
- [ ] A 406 (already initialised) raises `HemOperationFailedError`; a 403
      (clock not set) raises `HemForbiddenError` stating that a check-in is
      needed.
- [ ] (M3B) attended, and only if the user chooses to wipe and provision a
      device: the challenge is obtained from a factory-fresh device.
