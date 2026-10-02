---
id: REQ-SYS-029
title: Device reboot
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-013", "REQ-SYS-017"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Device reboot

The library SHALL provide a call for `GET /api/system/reboot` that reboots
the device.

**Rationale:** A reboot is needed after a TLS import and is the remedy for
several device states. The device answers 200, closes the connection and
restarts about 2 seconds later [YAML]. Introduced in M3.

**Acceptance criteria:**
- [ ] The scope used is `system:config`.
- [ ] A dropped connection after the request is handled per REQ-API-013.
- [ ] A 409 (install in progress) raises `HemDeviceStateError`.
- [ ] (M3B) attended and disruptive: the device is rebooted and the time
      until it answers again is recorded.
