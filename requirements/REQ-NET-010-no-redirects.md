---
id: REQ-NET-010
title: Redirects not followed
status: verified
priority: should
revision: 1
source: ARCHITECTURE.md §7
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Redirects not followed

The client SHOULD treat an HTTP redirect from the device as an error instead
of following it.

**Rationale:** The device has no reason to redirect. Following one could
send a bearer token to another host. Introduced in M1.

**Acceptance criteria:**
- [ ] Device requests are made with redirect following disabled.
- [ ] A redirect response raises an error; no second request is made.
