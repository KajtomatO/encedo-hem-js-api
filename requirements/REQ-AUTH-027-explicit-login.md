---
id: REQ-AUTH-027
title: Explicit login reporting the session
status: draft
priority: should
revision: 1
source: user decision 2026-10-12 (STEP-M1B-130, surface changes before 0.1.0); https://github.com/KajtomatO/encedo-hem-c-api (its session engine exposes no token either)
depends_on: ["REQ-AUTH-001", "REQ-AUTH-004", "REQ-AUTH-010"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#4-public-api--conventions"]
---

# Explicit login reporting the session

The client SHALL provide `auth.login(scope)`, which obtains the token for
that scope (or reuses the cached one) and resolves with the scope, the
granted role and the expiry, never with the token.

**Rationale:** Logins happen implicitly at the first operation that needs
them. A server that starts up wants to know whether its credentials work,
and what the device granted, before it serves traffic — without performing
a key operation to find out (the health check deliberately makes no
authenticated call). The token itself stays out of reach (D12,
REQ-API-009). Introduced in M1B.

**Acceptance criteria:**
- [ ] The result is `{ scope, role, expiresAt }` (`expiresAt` in Unix
      seconds, from the token's `exp` claim) and has no field holding the
      token.
- [ ] A valid cached token for the scope is reused without a request.
- [ ] In mobile-login mode the token is obtained through approval
      (REQ-AUTH-019).
- [ ] Failures are those of the login itself (for example
      `HemUnauthenticatedError` for a wrong passphrase).
- [ ] (M1B) on the test device, `auth.login('keymgmt:list')` reports the
      user role and an expiry about 8 hours ahead.
