---
id: REQ-NET-009
title: Only headers the device's CORS policy allows
status: verified
priority: must
revision: 5
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
- [x] A unit test records the headers of every binding's request and finds
      only names from the list.
- [x] `Content-Type` is set only when there is a body, `Authorization` only
      on authenticated operations, `Content-Disposition` only on uploads.
- [x] (M1B) attended: a request from a browser page whose origin is on the
      device's allow-list passes preflight and succeeds — 2026-10-12,
      headless Chromium 153, allow-list `*`: from `https://app.example` and
      `http://localhost:8080` a login and `keys.list` (with `Authorization`,
      so preflighted) succeeded. The device answered the preflight with 204,
      echoing the origin and allowing `Authorization`. Chromium first
      requires the user's local-network-access permission for the site
      (tests/attended/browser.test.ts).
