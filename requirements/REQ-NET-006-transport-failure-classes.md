---
id: REQ-NET-006
title: Transport failures classified
status: verified
priority: must
revision: 1
source: start_point G14
depends_on: ["REQ-API-002", "REQ-NET-004", "REQ-NET-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#4-public-api--conventions"]
---

# Transport failures classified

A call that fails without an HTTP response SHALL be reported as exactly one
of: timed out, aborted by the caller, or device unreachable.

**Rationale:** A circuit breaker treats an unreachable device differently
from a deliberate cancellation, so the three cases need separate error
classes. Introduced in M1.

**Acceptance criteria:**
- [ ] A rejected `fetch` raises `HemUnreachableError` with the original
      error attached as its cause.
- [ ] An elapsed time limit raises `HemTimeoutError`; a caller abort raises
      `HemAbortError`.
- [ ] When the time limit and a caller abort race, the one that fired first
      decides the error.
- [ ] (M1B) what Node's `fetch` reports for a powered-off device, a name
      that does not resolve and an expired certificate is recorded.
