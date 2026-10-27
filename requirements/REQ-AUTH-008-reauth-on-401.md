---
id: REQ-AUTH-008
title: Re-authentication after a 401
status: verified
priority: must
revision: 4
source: start_point G11; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-004", "REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
---

# Re-authentication after a 401

When an authenticated call is answered with 401, the session SHALL discard
the token for that scope, obtain a new one and repeat the call exactly once.

**Rationale:** Tokens are signed with a per-boot key, so every token dies
when the device reboots [YAML]. The client cannot see a reboot coming; the
401 is how it finds out. Introduced in M1.

**Acceptance criteria:**
- [x] A 401 followed by a 200 resolves the call; the request sequence is
      call, challenge, proof, call.
- [x] A second 401 raises `HemUnauthenticatedError`; there is no third
      attempt.
- [x] Only the token of the affected scope is discarded.
- [x] (M1B) attended: after the device is rebooted, the next call succeeds
      with no action by the caller — 2026-10-12: soft reboot by the user
      (C client `reboot`), device back after ~2 min; the next `keys.list` on
      the same client succeeded in 3.1 s with exactly one new login (the
      old token's 401, then one check-in because the reboot had cleared the
      clock) (tests/attended/power-cycle.test.ts).
