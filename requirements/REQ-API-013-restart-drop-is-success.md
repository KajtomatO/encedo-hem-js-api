---
id: REQ-API-013
title: Dropped connection after a restart request is not an error
status: approved
priority: must
revision: 1
source: start_point M3.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Dropped connection after a restart request is not an error

An operation after which the device closes the connection and restarts SHALL
report success when the request was sent and the connection then dropped
without a response.

**Rationale:** Firmware install, reboot, shutdown, wipe and the switch to
USB mode answer 200 and then close the connection, or restart before a reply
gets through [YAML]. Reporting that as a network failure would make every
successful restart look broken. Introduced in M3.

**Acceptance criteria:**
- [ ] For each of firmware install, reboot, shutdown, wipe and USB mode: a
      `fetch` that rejects after the request was dispatched resolves the
      call, and so does a 200 response.
- [ ] The result states whether the device acknowledged with a response or
      the connection simply dropped.
- [ ] An error status (401, 403, 406, 409) is still an error.
- [ ] The token cache is emptied after any of these operations.
- [ ] (M3B) how `fetch` reports the dropped connection, and whether it can
      be told apart from an unreachable device, is recorded for each
      operation the user chooses to exercise.
