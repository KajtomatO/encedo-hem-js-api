---
id: REQ-AUTH-019
title: Mobile approval as the client's login mode
status: draft
priority: must
revision: 1
source: start_point §3; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-018", "REQ-AUTH-008"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
---

# Mobile approval as the client's login mode

A client configured for mobile approval instead of a passphrase SHALL obtain
every token it needs through the approval engine.

**Rationale:** The MVP goal includes a human approving access from a paired
app as an alternative to a stored passphrase. Making it a login mode means
the rest of the API works unchanged. Introduced in M1.

**Acceptance criteria:**
- [ ] On a mobile-mode client with an empty cache, an authenticated call
      triggers one approval for that operation's scope and then proceeds.
- [ ] While the token is valid, further calls for that scope cause no new
      approval.
- [ ] A client has either a passphrase or mobile mode, not both.
- [ ] A 401 on a token obtained this way leads to one new approval and one
      repeated call.
- [ ] (M1B) attended: an HMAC operation completes after approval on the
      phone; the number of pushes for calls on two different keys is
      recorded ([C-SDK] reports one per key scope).
