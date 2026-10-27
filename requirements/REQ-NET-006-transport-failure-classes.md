---
id: REQ-NET-006
title: Transport failures classified
status: verified
priority: must
revision: 5
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
- [x] A rejected `fetch` raises `HemUnreachableError` with the original
      error attached as its cause.
- [x] An elapsed time limit raises `HemTimeoutError`; a caller abort raises
      `HemAbortError`.
- [x] When the time limit and a caller abort race, the one that fired first
      decides the error.
- [x] (M1B) what Node's `fetch` reports for a powered-off device, a name
      that does not resolve and an expired certificate is recorded.
      2026-10-07, through the Node transport (REQ-NET-013): a name that does
      not resolve → `HemUnreachableError` with cause `ENOTFOUND`
      (`getaddrinfo ENOTFOUND no-such-host.invalid`); a certificate the
      trust anchors cannot validate → cause
      `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. An expired certificate was not
      observable: the device's certificate was renewed that day (valid to
      2027-01-05). Powered off, 2026-10-12: `HemUnreachableError` with
      cause `ENETUNREACH` (`connect ENETUNREACH 192.168.7.1:443`) — the
      device is the USB network adapter, so unplugging it removes the route.
      The expired-certificate case needs an expired device certificate
      and is **carried to M3B** (user decision 2026-10-20, at the gate):
      TLS import lands in M3, where the case can be observed.
