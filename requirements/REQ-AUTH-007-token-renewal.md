---
id: REQ-AUTH-007
title: Renewal before expiry
status: approved
priority: must
revision: 1
source: start_point G11; ARCHITECTURE.md §5; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-004", "REQ-AUTH-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour"]
---

# Renewal before expiry

The session SHALL obtain a fresh token before using one that is within 60
seconds of its expiry.

**Rationale:** A token that expires between the client's check and the
device's check costs a failed call. A margin avoids that; 60 seconds is the
margin the C client uses [C-SDK]. Introduced in M1.

**Acceptance criteria:**
- [ ] With an injected clock: at 61 seconds before expiry the cached token
      is used; at 60 seconds a login happens before the call.
- [ ] Renewal happens on demand; the library starts no background timer.
- [ ] (M1B) with a short configured lifetime, a call made after the token
      has passed its margin triggers a login and succeeds.
