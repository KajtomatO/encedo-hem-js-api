---
id: REQ-AUTH-013
title: Concurrent calls share one login
status: draft
priority: should
revision: 1
source: ARCHITECTURE.md §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-004"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
---

# Concurrent calls share one login

Concurrent calls that need a token for the same scope SHOULD share a single
login.

**Rationale:** Parallel calls on a cold cache would otherwise each start
their own slow login, and the device answers logins with a deliberate delay
[YAML]. Introduced in M1.

**Acceptance criteria:**
- [ ] Five concurrent calls for one scope on an empty cache cause one
      challenge and one proof.
- [ ] If that login fails, every waiting call is rejected with an error of
      the same class.
- [ ] The next call after a failed login starts a new one.
