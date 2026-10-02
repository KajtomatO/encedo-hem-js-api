---
id: REQ-SYS-022
title: Firmware install
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.2; start_point M3.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-012", "REQ-API-013", "REQ-SYS-017"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Firmware install

The library SHALL provide a dedicated call for `GET
/api/system/upgrade/install_fw` that installs the verified firmware image.

**Rationale:** Installing reboots the device into its bootloader and
replaces the firmware; no further HTTP traffic follows [YAML]. It is
irreversible, so it is a call of its own (REQ-API-012). Introduced in M3.

**Acceptance criteria:**
- [ ] A dropped connection after the request is handled per REQ-API-013.
- [ ] A 406 (no verified image) and a 409 (another install in progress)
      raise their error classes.
- [ ] The call never happens as a side effect of upload or check.
- [ ] (M3B) attended and disruptive: exercised only if the user decides to.
