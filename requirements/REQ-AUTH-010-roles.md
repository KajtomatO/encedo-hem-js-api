---
id: REQ-AUTH-010
title: User and master roles
status: verified
priority: must
revision: 1
source: start_point G12; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-001"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
---

# User and master roles

The session SHALL expose the role the device granted — user, master or
paired app — as read from the `sub` claim of the issued token.

**Rationale:** The device decides the role by which registered key the
proof's `iss` matches: the user key gives `U`, the master key gives `M`;
tokens from a paired app carry the app's key id. Master tokens are refused
by every key-management and crypto operation [YAML]. Both roles log in
through the same flow, each with its own passphrase. Introduced in M1.

**Acceptance criteria:**
- [ ] A token with `sub` `U` reports the user role, `M` the master role, and
      any other value the app role together with that value.
- [ ] A master-role session that calls a key-management or crypto operation
      gets the device's 403 as `HemForbiddenError`.
- [ ] (M1B) a login with the user passphrase reports the user role.
- [ ] (M1B) a login with the master passphrase reports the master role and
      an administrative scope is granted. Carried to M3B if the test
      device's master passphrase is not available (ARCHITECTURE.md §11, risk
      9).
