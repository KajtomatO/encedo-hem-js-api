---
id: REQ-NET-004
title: Time limit on every call
status: verified
priority: must
revision: 1
source: start_point G7; https://github.com/KajtomatO/encedo-hem-c-api; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Time limit on every call

Every call SHALL fail with a timeout error when no complete response arrives
within its time limit.

**Rationale:** A stalled device must not hang the consumer [C-SDK records
stalls of tens of seconds]. The default has to leave room for the deliberate
login delay of 0.5 to 1.5 seconds [YAML]. Introduced in M1.

**Acceptance criteria:**
- [ ] The default limit is 30 000 ms and can be set per client and per call.
- [ ] With a `fetch` that never settles and fake timers, the call rejects
      with `HemTimeoutError` at the limit, and the signal given to `fetch`
      is aborted.
- [ ] The limit also covers reading the response body.
- [ ] A call that needs a login first applies the limit to each request, not
      to the sum.
- [ ] (M1B) the default limit is enough for login and for every M1
      operation; the slowest observed time is recorded.
