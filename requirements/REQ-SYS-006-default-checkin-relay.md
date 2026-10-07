---
id: REQ-SYS-006
title: Check-in relay, replaceable, with a default for the Encedo backend
status: verified
priority: must
revision: 4
source: user decision 2026-10-02; start_point M1.3; start_point §6 Q3; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Check-in relay, replaceable, with a default for the Encedo backend

The library SHALL ship a default check-in relay that posts the device's
check-in token to `https://api.encedo.com/checkin` and returns the backend's
reply, behind an interface through which the caller can replace it.

**Rationale:** The backend is the answer to open question Q3: it takes
`{check}` and returns `{checked}`, unauthenticated [C-SDK]. Clock recovery
(REQ-AUTH-009) depends on it, so a default has to exist; a consumer that
must control outbound traffic can substitute its own or remove it.
Introduced in M1.

**Acceptance criteria:**
- [x] The default relay sends a POST with JSON `{check}` and returns the
      `checked` string from the reply.
- [x] It uses its own `fetch` (the global one by default), never the device
      `fetch`; the URL is configurable.
- [x] A status other than 200 raises an error carrying the status and body.
- [x] The client accepts any implementation of the exported relay interface;
      a unit test runs a check-in with an in-memory relay and makes no
      request to `api.encedo.com`.
- [x] (M1B) the real backend returns a reply for the test device —
      2026-10-07: `https://api.encedo.com/checkin` answered in 268 ms with a
      415-character JWT-shaped `checked` (claims `jti`, `iat`, `iss`,
      `aud`, `status`) that the device accepted.
- [ ] (M1B) whether the backend accepts requests from a browser origin is
      recorded (ARCHITECTURE.md §11, risk 11).
