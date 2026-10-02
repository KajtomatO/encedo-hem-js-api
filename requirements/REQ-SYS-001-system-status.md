---
id: REQ-SYS-001
title: Device status
status: verified
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Device status

The library SHALL provide a call for `GET /api/system/status` that returns
the device's liveness, initialisation state, clock state and self-test fault
state.

The device leaves fields out instead of sending defaults [YAML]: `inited`
appears only when false, `ts` and `time` only when the clock is set, `https`
only on a plain-HTTP request, `hostname` only when the request's host does
not match, `tts` only when trusted time is off, `fw_upgrade` only right
after an upgrade. The result turns these into explicit values.

**Rationale:** Status is the one call that works without a token on any
device in any state, which makes it the basis for health checks. Introduced
in M1.

**Acceptance criteria:**
- [ ] No `Authorization` header is sent.
- [ ] The always-present fields `ctx`, `uptime`, `temp` and `fls_state` are
      required; their absence raises `HemProtocolError`.
- [ ] The result reports initialised as true unless `inited` is false, and
      clock-set as true exactly when `ts` or `time` is present.
- [ ] `storage` and `format`, present only on mass-storage hardware, are
      passed through when present.
- [ ] (M1B) the live response of the test device is recorded and parses.
