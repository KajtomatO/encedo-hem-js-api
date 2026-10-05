---
id: STEP-M1A-130
title: Token cache, scope selection, renewal, logout
milestone: M1A
implements: ["REQ-AUTH-004", "REQ-AUTH-005", "REQ-AUTH-007", "REQ-AUTH-010", "REQ-AUTH-012", "REQ-API-001", "REQ-API-009", "REQ-AUTH-011", "REQ-NET-004"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-120"]
evidence:
  commits: ["eeb69c0"]
  tests: ["verifies: REQ-AUTH-004 (tests/unit/session.test.ts)", "verifies: REQ-AUTH-005 (tests/unit/session.test.ts)", "verifies: REQ-AUTH-007 (tests/unit/session.test.ts)", "verifies: REQ-AUTH-010 (tests/unit/session.test.ts)", "verifies: REQ-AUTH-012 (tests/unit/session.test.ts)", "verifies: REQ-API-001 (tests/unit/session.test.ts)", "verifies: REQ-API-009 (tests/unit/session.test.ts)", "verifies: REQ-AUTH-011 (tests/unit/session.test.ts)", "verifies: REQ-NET-004 (tests/unit/session.test.ts)"]
  notes: "npm run check: 36 files, 634 tests passed in Node v24.21.0 and headless Chromium. Session engine in src/auth/session.ts; client.auth exposes role (Role: user | master | app with id) and logout(). Authenticated behaviour is driven by test-only operation descriptions until STEP-M1A-160. REQ-AUTH-012 is tested here for status, version, both check-in steps and both login steps; ext/request and ext/token are added in STEP-M1A-230. The fake fetch now lets one-shot replies override an always() fallback (supporting change, with its own test)."
reopened: []
cancelled: null
---

**Goal:** An authenticated operation declares its scope and the session
supplies a valid bearer token for exactly that scope — from the cache or by
logging in — renewing it before expiry. Public operations never get a token,
and logout empties everything.

**Notes:**
- Cache (REQ-AUTH-004): one token per exact scope string, per client, in
  memory only. The expiry is read from the token's own `exp` claim by
  decoding its payload, falling back to the requested expiry when the token
  cannot be decoded.
- Renewal (REQ-AUTH-007): a token within 60 seconds of expiry is replaced
  before the call; on demand, with no background timer. Tests use the
  injectable clock of STEP-M1A-120.
- Scope (REQ-AUTH-005): a binding hands the engine the scope from its
  operation description, or none; the engine never picks a scope the binding
  did not declare (ARCHITECTURE.md §3).
- Role (REQ-AUTH-010): read from the `sub` claim of the issued token — `U`,
  `M`, or anything else as the app role with that value. How the client
  exposes it is settled here.
- No authenticated M1 binding exists yet (keys arrive in STEP-M1A-160), so
  the engine tests use a test-only operation description; the real
  operations exercise the engine from STEP-M1A-160 on.
- `logout()` discards the credential and every cached token.
- The time limit applies to each request — challenge, proof, call — not to
  their sum (REQ-NET-004).
- Partly closed here: REQ-API-001 (clients do not share tokens or
  credentials), REQ-API-009 (failed authenticated call), REQ-AUTH-011 (after
  logout), REQ-NET-004 (limit per request). Closed elsewhere: REQ-AUTH-005
  table over every operation and REQ-AUTH-012 for `ext/request` and
  `ext/token` in STEP-M1A-230; REQ-AUTH-010 master 403 in STEP-M1A-160.

**Definition of done**
- [x] Two calls needing the same scope cause one login; calls needing
      different scopes obtain separate tokens.
- [x] The cache key is the exact string: `keymgmt:use:<kid A>` and
      `keymgmt:use:<kid B>` are different entries, and a `keymgmt:list` token
      is not used for `keymgmt:search`.
- [x] The expiry is read from the token's own `exp` claim, falling back to
      the requested expiry when the token cannot be decoded.
- [x] The token is sent as `Authorization: Bearer <token>`.
- [x] With an injected clock: at 61 seconds before expiry the cached token is
      used; at 60 seconds a login happens before the call. No background
      timer is started.
- [x] A token with `sub` `U` reports the user role, `M` the master role, and
      any other value the app role together with that value.
- [x] With tokens cached, the calls for status, version, both check-in steps
      and both login steps carry no `Authorization` header.
- [x] After logout an authenticated call raises `HemUnauthenticatedError`
      without any request, and the token cache is empty.
- [x] Two clients used in the same test do not share tokens or credentials;
      the cache exists only in memory.
- [x] A call that needs a login first applies the time limit to each request,
      not to the sum.
- [x] The error of a failed authenticated call — message, properties and JSON
      form — contains no token.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
