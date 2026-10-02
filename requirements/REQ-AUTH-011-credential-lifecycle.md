---
id: REQ-AUTH-011
title: Credentials held in memory and discarded on logout
status: draft
priority: must
revision: 1
source: start_point G13
depends_on: ["REQ-API-009"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
---

# Credentials held in memory and discarded on logout

The session SHALL hold credentials and tokens only in memory and discard all
of them when the caller logs out.

**Rationale:** Nothing that unlocks the device should outlive the client
object or the caller's decision to end the session. Introduced in M1.

**Acceptance criteria:**
- [ ] After logout, an authenticated call raises `HemUnauthenticatedError`
      without any request, and the token cache is empty.
- [ ] The passphrase is not retained after the private key has been derived;
      the derived key is kept bound to the `eid` it was derived for.
- [ ] A challenge carrying a different `eid` than the one the key was
      derived for raises `HemUnauthenticatedError` stating that the device
      identity changed.
- [ ] The private key is held as a non-extractable `CryptoKey` where the
      runtime allows it.
