---
id: REQ-API-010
title: Targeted API version exported
status: approved
priority: must
revision: 1
source: start_point G19
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#4-public-api--conventions"]
---

# Targeted API version exported

The package SHALL export the API version it targets, `1.2.2`, as a constant.

**Rationale:** A caller checking compatibility needs two values: what the
library was written for, and what the device runs. The second comes from the
version operation (REQ-SYS-002). Introduced in M1.

**Acceptance criteria:**
- [ ] The exported constant equals `1.2.2`.
- [ ] The README explains how to compare it with the firmware version read
      from the device.
