---
id: REQ-SYS-025
title: Dashboard activation
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-017", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Dashboard activation

The library SHALL provide a call for `GET /api/system/upgrade/install_ui`
that activates the verified dashboard.

**Rationale:** Activation is the last step of a dashboard upgrade. Unlike a
firmware install it answers normally and does not restart the device [YAML].
Introduced in M3.

**Acceptance criteria:**
- [ ] The scope used is `system:upgrade`; a 200 resolves the call.
- [ ] A 406 (no verified dashboard) and a 409 (install in progress) raise
      their error classes.
- [ ] (M3B) attended: exercised only if the user decides to.
