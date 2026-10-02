---
id: STEP-M1A-160
title: Mobile approval — device calls, relay interface, default broker relay
milestone: M1A
implements: ["REQ-AUTH-014", "REQ-AUTH-015", "REQ-AUTH-016", "REQ-AUTH-017"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-130"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.auth` binds `POST /api/auth/ext/request` and
`POST /api/auth/ext/token`; `src/relay/approval.ts` exports the approval
relay interface (obtain key, submit, check) and the default relay for the
Encedo broker at `https://api.encedo.com/notify`.

**Notes:** ext/request: body `{epk, scope}` plus `ctx` and `note` when
given; no token; result `{authreq, epk}` as opaque strings; validation: epk
decodes to 32 bytes, scope at most 1023 characters, `ctx` 1 to 64, `note` 1
to 128 characters; a 403 runs the single check-in recovery of STEP-M1A-130.
ext/token: body `{authreply}`; no token; the token is cached under the
originally requested scope with expiry from its `exp`; 401 is
`HemUnauthenticatedError`, 406 is `HemOperationFailedError`. Default relay:
`GET /session` gives `{epk, exp}`; `POST /event/new` with `{authreq, epk}`
gives `{eventid}`; `GET /event/check/<eventid>` is 202 pending, 200
`{"deny":true}` rejected, 200 `{authreply}` approved, 404 expired; other
statuses are an error carrying status and body; own `fetch`, configurable
base URL. With the relay set to none the two device calls still work; the
engine (STEP-M1A-170) raises `HemUnsupportedError`.

**Definition of done**
- [ ] ext/request: body, no `Authorization`, opaque result; each validation limit raises `HemValidationError`; a 403 triggers the single check-in recovery
- [ ] ext/token: body `{authreply}`, no `Authorization`; the token is cached under the requested scope with expiry from `exp`; 401 raises `HemUnauthenticatedError`, 406 raises `HemOperationFailedError`
- [ ] The relay interface is exported with obtain-key, submit and check (pending, approved with the reply, rejected, expired); the client accepts any implementation
- [ ] The default relay performs the three broker calls and maps responses as stated; any other status raises an error carrying status and body; it uses its own `fetch`, never the device one; the base URL is configurable
- [ ] A unit test completes both device calls with an in-memory relay and no request leaves for `api.encedo.com`
