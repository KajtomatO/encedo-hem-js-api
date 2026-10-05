---
id: STEP-M1A-190
title: Mobile approval — device calls and approval relay
milestone: M1A
implements: ["REQ-AUTH-014", "REQ-AUTH-015", "REQ-AUTH-016", "REQ-AUTH-017"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#3-component-overview"]
depends_on: ["STEP-M1A-150"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The two device calls of mobile approval work on their own, and an
exported approval-relay interface has a default implementation for the
Encedo broker.

**Notes:**
- Device calls, neither with a token [YAML]: `POST /api/auth/ext/request`
  with `{epk, scope, ctx?, note?}` returns `{authreq, epk}`; `POST
  /api/auth/ext/token` with `{authreply}` returns `{token}`.
- `ext/request` input limits are in REQ-AUTH-014; the firmware silently
  drops out-of-range values [C-SDK], so they are rejected before sending.
- A 403 on `ext/request` (clock not set) gets the same single check-in
  recovery as a login, reusing STEP-M1A-150.
- `ext/token` files the token under the scope that was originally requested,
  so the call has to be told that scope. A 401 here is final: this is a
  public operation and is not retried through a login.
- Relay interface (REQ-AUTH-016): three operations — obtain the key to use
  as `epk`, submit an authorization request, check for the outcome. The
  client accepts any implementation, or none.
- Default relay (REQ-AUTH-017): base `https://api.encedo.com/notify`; the
  three broker calls and their response mapping are in the REQ's table, as
  reconstructed and live-confirmed by [C-SDK]. It uses its own `fetch`, and
  its requests do not pass through the device queue.
- For REQ-AUTH-020 (STEP-M1A-200) the error of a failed submit has to expose
  the broker's status to the engine.
- The broker API is undocumented and can change (ARCHITECTURE.md §11 risk
  5); keep everything broker-specific inside the default relay.
- Open point — opaque strings and REQ-API-004. REQ-AUTH-014 returns `authreq`
  and `epk` "as opaque strings", and ARCHITECTURE.md §5.3 says everything in
  this flow is opaque to the client. REQ-API-004 allows text only for key
  ids and opaque tokens. `epk` is a 32-byte key in base64. Treat the
  relay-carried values as opaque tokens here; STEP-M1A-230 confirms that
  reading with the user when it checks the surface against REQ-API-004.
- Same open point as STEP-M1A-110 for the error class of a failed relay
  call.
- Closed elsewhere: REQ-AUTH-016 "approval with an in-memory relay" and
  "relay set to none" in STEP-M1A-200 and STEP-M1A-210 (listed there).

**Definition of done**
- [ ] `ext/request`: the body is `{epk, scope}` plus `ctx` and `note` when
      given; no `Authorization` header is sent; the result is `{authreq,
      epk}` as opaque strings.
- [ ] `ext/request`: `HemValidationError` is raised when `epk` does not
      decode to 32 bytes, the scope exceeds 1023 characters, `ctx` is not 1
      to 64 characters or `note` is not 1 to 128 characters.
- [ ] `ext/request`: a 403 leads to one check-in and one repeated request,
      never more.
- [ ] `ext/token`: the body is `{authreply}`; no `Authorization` header is
      sent; the result is the token.
- [ ] `ext/token`: the token is cached under the scope that was originally
      requested, with the expiry taken from its `exp` claim.
- [ ] `ext/token`: a 401 raises `HemUnauthenticatedError`; a 406 raises
      `HemOperationFailedError`.
- [ ] The relay interface with its three operations is exported, and the
      client accepts any implementation of it as an option.
- [ ] Default relay: each operation makes the broker call of the
      REQ-AUTH-017 table and maps 202, `{"deny":true}`, `{authreply, …}` and
      404 as stated; any other broker status raises an error carrying the
      status and the body.
- [ ] Default relay: it uses its own `fetch`, never the device `fetch`; the
      base URL is configurable.
- [ ] Each device call has unit tests asserting method, path, headers, body
      and response mapping, and TSDoc stating scope and milestone.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
