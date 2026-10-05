---
id: STEP-M1A-190
title: Mobile approval — device calls and approval relay
milestone: M1A
implements: ["REQ-AUTH-014", "REQ-AUTH-015", "REQ-AUTH-016", "REQ-AUTH-017"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#3-component-overview"]
depends_on: ["STEP-M1A-150"]
evidence:
  commits: ["618c352"]
  tests: ["verifies: REQ-AUTH-014 (tests/unit/approval-calls.test.ts)", "verifies: REQ-AUTH-015 (tests/unit/approval-calls.test.ts)", "verifies: REQ-AUTH-016 (tests/unit/approval-calls.test.ts)", "verifies: REQ-AUTH-017 (tests/unit/approval-relay.test.ts)"]
  notes: "npm run check (twice): 46 files, 930 tests passed in Node v24.21.0 and headless Chromium. Device calls are client.auth.requestApproval and client.auth.redeemApproval; the relay interface is ApprovalRelay (getKey, submit, check), default EncedoApprovalRelay; client option approvalRelay (default broker relay, null disables). Relay failures raise HemRelayError with the broker's status, which the engine needs for REQ-AUTH-020. A redeemed token without an exp claim is kept until the device rejects it. Relay-carried values (epk, authreq, authreply) are treated as opaque strings; confirming that reading of REQ-API-004 with the user is left to STEP-M1A-230. Fixed on the way: a session without a credential refused even a cached (redeemed) token; and the pacing start time is now taken when fetch is called, not a microtask earlier."
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
- [x] `ext/request`: the body is `{epk, scope}` plus `ctx` and `note` when
      given; no `Authorization` header is sent; the result is `{authreq,
      epk}` as opaque strings.
- [x] `ext/request`: `HemValidationError` is raised when `epk` does not
      decode to 32 bytes, the scope exceeds 1023 characters, `ctx` is not 1
      to 64 characters or `note` is not 1 to 128 characters.
- [x] `ext/request`: a 403 leads to one check-in and one repeated request,
      never more.
- [x] `ext/token`: the body is `{authreply}`; no `Authorization` header is
      sent; the result is the token.
- [x] `ext/token`: the token is cached under the scope that was originally
      requested, with the expiry taken from its `exp` claim.
- [x] `ext/token`: a 401 raises `HemUnauthenticatedError`; a 406 raises
      `HemOperationFailedError`.
- [x] The relay interface with its three operations is exported, and the
      client accepts any implementation of it as an option.
- [x] Default relay: each operation makes the broker call of the
      REQ-AUTH-017 table and maps 202, `{"deny":true}`, `{authreply, …}` and
      404 as stated; any other broker status raises an error carrying the
      status and the body.
- [x] Default relay: it uses its own `fetch`, never the device `fetch`; the
      base URL is configurable.
- [x] Each device call has unit tests asserting method, path, headers, body
      and response mapping, and TSDoc stating scope and milestone.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
