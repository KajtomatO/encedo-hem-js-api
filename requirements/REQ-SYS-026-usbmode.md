---
id: REQ-SYS-026
title: Reboot into USB mode
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-api-doc
depends_on: ["REQ-API-013", "REQ-SYS-017"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Reboot into USB mode

The library SHALL provide a dedicated call for `GET
/api/system/upgrade/usbmode` that reboots the device into its USB mode.

**Rationale:** The reference calls the target "USB mass-storage mode"
[YAML]; [DOC] describes it as a serial mode for uploading firmware. Either
way the device leaves the network, so the call is its own and is treated as
a restart. Introduced in M3.

**Acceptance criteria:**
- [ ] The scope used is `system:upgrade`.
- [ ] A dropped connection after the request is handled per REQ-API-013.
- [ ] A 406 and a 409 raise their error classes.
- [ ] (M3B) attended and disruptive: exercised only if the user decides to;
      what the device then presents over USB is recorded.
