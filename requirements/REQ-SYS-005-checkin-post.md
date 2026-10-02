---
id: REQ-SYS-005
title: Check-in step 2
status: draft
priority: must
revision: 1
source: start_point M1.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002", "REQ-API-007"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Check-in step 2

The library SHALL provide a call for `POST /api/system/checkin` that hands
the backend's reply to the device and returns the device's result.

The device validates the reply, sets its clock from it, and — when its
trusted-backend option is on — executes the management action the reply
carries: `L` erases the user key, `W` wipes the device and reboots, `B`
stops the web servers, `U` forces an upgrade, `R` reports [YAML].

**Rationale:** The second step can change or disable the device on the
backend's say-so. A caller relaying replies has to know that, so the call's
documentation states it. Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{checked}` with the reply string unmodified; no
      `Authorization` header is sent.
- [ ] The result contains `status`, and `newcrt`, `newfws` and `newuis` when
      present.
- [ ] A 401 (reply invalid, nonce unknown or issuer not trusted) raises
      `HemUnauthenticatedError` without a login attempt.
- [ ] The call's documentation lists the management actions and the
      condition under which they run.
- [ ] (M1B) after a completed check-in the status call reports the clock as
      set.
