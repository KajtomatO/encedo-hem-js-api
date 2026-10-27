---
id: REQ-NET-004
title: Time limit on every call
status: verified
priority: must
revision: 4
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
- [x] The default limit is 30 000 ms and can be set per client and per call.
- [x] With a `fetch` that never settles and fake timers, the call rejects
      with `HemTimeoutError` at the limit, and the signal given to `fetch`
      is aborted.
- [x] The limit also covers reading the response body.
- [x] A call that needs a login first applies the limit to each request, not
      to the sum.
- [x] (M1B) the default limit is enough for login and for every M1
      operation; the slowest observed time is recorded — 2026-10-20
      [device], gate run with 150 ms pacing: the slowest single call is the
      login proof `POST /api/auth/token` at about 750 ms (719–749 ms over
      the M1B runs); a check-in round trip (device, backend, device) takes
      about 550–870 ms; a status call about 220 ms; everything else is
      faster. The 30 s default was never approached.
