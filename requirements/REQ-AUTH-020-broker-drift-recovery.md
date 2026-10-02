---
id: REQ-AUTH-020
title: Recovery when the broker rejects a request for clock drift
status: approved
priority: should
revision: 1
source: https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-017", "REQ-SYS-007"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval"]
---

# Recovery when the broker rejects a request for clock drift

When the default relay's submit call is rejected because the authorization
request's `iat` is not acceptable to the broker's clock, the approval engine
SHOULD run one check-in and submit a fresh request.

Drift evidence: the broker answers 401, and the `iat` claim decoded from the
authorization request is more than 2 seconds ahead of, or more than 15
seconds behind, the local time [C-SDK].

**Rationale:** The broker checks `iat` against its own clock with almost no
tolerance for the future, and the device clock runs fast; [C-SDK] saw mobile
approval break minutes after a clock sync. Introduced in M1.

**Acceptance criteria:**
- [ ] A 401 with drift evidence leads to one check-in, a new `ext/request`
      and a new submit.
- [ ] A 401 without drift evidence is reported as an error with zero
      check-in requests.
- [ ] This happens at most once per approval attempt.
- [ ] (M1B) attended: whether the drift rejection occurs on the test device,
      and whether the recovery clears it, is recorded.
