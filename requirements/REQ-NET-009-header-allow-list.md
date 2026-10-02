---
id: REQ-NET-009
title: Only headers the device's CORS policy allows
status: approved
priority: must
revision: 1
source: start_point §6 Q6; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Only headers the device's CORS policy allows

The library SHALL NOT set any request header on a device request other than
`Content-Type`, `Authorization` and `Content-Disposition`.

**Rationale:** The device's preflight response allows `Content-Type`,
`Cache-Control`, `Pragma`, `Expires`, `Authorization` and
`Content-Disposition` [YAML]. Any other custom header would make every
browser request fail before it is sent. Introduced in M1.

**Acceptance criteria:**
- [ ] A unit test records the headers of every binding's request and finds
      only names from the list.
- [ ] `Content-Type` is set only when there is a body, `Authorization` only
      on authenticated operations, `Content-Disposition` only on uploads.
- [ ] (M1B) attended: a request from a browser page whose origin is on the
      device's allow-list passes preflight and succeeds.
