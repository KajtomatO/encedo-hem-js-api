---
id: REQ-AUTH-012
title: No token on operations that need none
status: approved
priority: must
revision: 1
source: ref/api/hem-api-1.2.2.yaml; ARCHITECTURE.md §5
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#2-context--constraints"]
---

# No token on operations that need none

The library SHALL NOT send an `Authorization` header on an operation that
the reference marks as needing no token.

**Rationale:** The device rejects a present but invalid token with 401
before routing [YAML]. A stale token attached to the status call would
therefore make a healthy device look broken — right after a reboot, which is
when health checks matter most. Introduced in M1.

**Acceptance criteria:**
- [ ] With tokens cached, the calls for status, version, check-in (both
      steps), login (both steps), `ext/request` and `ext/token` carry no
      `Authorization` header.
