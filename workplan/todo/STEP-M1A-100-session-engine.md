---
id: STEP-M1A-100
title: Session engine — token cache, scope selection, renewal, 401 retry
milestone: M1A
implements: ["REQ-AUTH-004", "REQ-AUTH-005", "REQ-AUTH-007", "REQ-AUTH-008", "REQ-AUTH-010", "REQ-AUTH-012", "REQ-AUTH-013"]
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1A-090"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Every binding declares its scope (or none); the engine supplies a
cached token of exactly that scope, logs in on a miss or within 60 s of
expiry, shares one in-flight login per scope, retries a 401 exactly once
after re-login, never attaches a token to a scope-less operation, and
exposes the role the device granted.

**Notes:** Cache keyed by the exact scope string; expiry from the token's
`exp` claim, else the requested expiry; injected clock for tests. Renewal
is on demand, no timers. On 401: drop that scope's token, log in again,
retry once; a second 401 is `HemUnauthenticatedError`. Single flight:
concurrent requests for one scope await one login; a failure rejects all
waiters with the same class; the next call starts afresh. The engine's
authenticated-request entry point is what every binding uses. The role is
read from the token's `sub`: `U` user, `M` master, anything else the app
role with that value. The per-operation scope table of ARCHITECTURE.md §6
is the test oracle; it grows with each binding step and is completed in
STEP-M1A-180.

**Definition of done**
- [ ] Two calls for one scope cause one login; different scopes get separate tokens; `keymgmt:use:<kid A>` and `keymgmt:use:<kid B>` are distinct entries and a `keymgmt:list` token is not used for `keymgmt:search`
- [ ] Expiry is read from the token's `exp`, falling back to the requested expiry when the token cannot be decoded; the cache belongs to one instance and lives in memory only
- [ ] The token is sent as `Authorization: Bearer <token>`; no device operation has a token parameter; crypto operations and key get request `keymgmt:use:<kid>` with the kid in lower case
- [ ] Injected clock: at 61 s before expiry the cached token is used, at 60 s a login happens first; the library starts no background timer
- [ ] A 401 followed by 200 resolves with the sequence call, challenge, proof, call; a second 401 raises `HemUnauthenticatedError` with no third attempt; only the affected scope's token is discarded
- [ ] Five concurrent calls for one scope on an empty cache cause one challenge and one proof; a failed login rejects every waiter with the same class; the next call starts a new login
- [ ] The role reports user for `sub` `U`, master for `M`, app with the value otherwise; a 403 on a key-management or crypto request surfaces as `HemForbiddenError`
- [ ] With tokens cached, requests whose declared scope is none carry no `Authorization` header
