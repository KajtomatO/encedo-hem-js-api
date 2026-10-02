---
id: REQ-SYS-024
title: Dashboard verification as start-and-poll
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-017", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Dashboard verification as start-and-poll

The library SHALL provide a dashboard-check operation that starts the
device's verification through `GET /api/system/upgrade/check_ui`, polls it
until it finishes, and returns a clear final result.

**Rationale:** The dashboard check is asynchronous in the same way as the
firmware check: 201 started, 202 running, 200 ready, 406 failed [YAML].
Introduced in M3.

**Acceptance criteria:**
- [ ] With a `fetch` replaying 201, 202, 200 the operation resolves as
      verified; with a final 406 it resolves as failed.
- [ ] A 409 (unexpected task state) raises `HemDeviceStateError`.
- [ ] The poll interval and the overall time limit are configurable;
      exceeding the limit raises `HemTimeoutError`.
- [ ] (M3B) attended: run after an upload, if the user decides to upload.
