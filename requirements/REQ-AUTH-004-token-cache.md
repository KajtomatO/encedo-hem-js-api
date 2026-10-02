---
id: REQ-AUTH-004
title: One cached token per scope
status: draft
priority: must
revision: 1
source: start_point G10; ARCHITECTURE.md §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-001"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
---

# One cached token per scope

The session SHALL keep at most one bearer token per exact scope string and
reuse it for every call needing that scope until it expires or is
invalidated.

**Rationale:** A token carries one scope [YAML], and every login costs a
deliberately slow round trip plus 600 000 PBKDF2 iterations. Caching per
scope keeps the number of logins equal to the number of distinct scopes in
use. Introduced in M1.

**Acceptance criteria:**
- [ ] Two calls needing the same scope cause one login.
- [ ] Calls needing different scopes obtain separate tokens.
- [ ] The cache key is the exact string: `keymgmt:use:<kid A>` and
      `keymgmt:use:<kid B>` are different entries, and a `keymgmt:list`
      token is not used for `keymgmt:search`.
- [ ] The expiry is read from the token's own `exp` claim, falling back to
      the requested expiry when the token cannot be decoded.
- [ ] The cache belongs to one client instance and exists only in memory.
