---
id: REQ-SYS-021
title: Firmware verification as start-and-poll
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-017", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Firmware verification as start-and-poll

The library SHALL provide a firmware-check operation that starts the
device's verification through `GET /api/system/upgrade/check_fw`, polls it
until it finishes, and returns a clear final result.

**Rationale:** The device verifies asynchronously: the first request answers
201, later ones 202 while it runs, then 200 for a good image or 406 for a
bad one [YAML]. Callers should not have to write that loop. Introduced in
M3.

**Acceptance criteria:**
- [ ] With a `fetch` replaying 201, 202, 202, 200 the operation resolves as
      verified; with a final 406 it resolves as failed.
- [ ] A 404 (nothing uploaded) raises an error saying so.
- [ ] The poll interval and the overall time limit are configurable;
      exceeding the limit raises `HemTimeoutError`.
- [ ] An `AbortSignal` stops the polling.
- [ ] (M3B) attended: run after an upload, if the user decides to upload.
