---
id: REQ-SYS-003
title: Single health operation
status: draft
priority: must
revision: 1
source: start_point M1.5
depends_on: ["REQ-SYS-001", "REQ-NET-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Single health operation

The library SHALL provide one health call that reports whether the device is
reachable, initialised, free of a latched self-test fault, and has its clock
set.

**Rationale:** A consumer's circuit breaker needs one cheap answer to "can I
use the device now". All four facts come from the status call; the health
call saves every consumer from re-deriving them. Introduced in M1.

**Acceptance criteria:**
- [ ] The call makes exactly one request, the status request.
- [ ] An unreachable device or an elapsed time limit yields a result with
      reachable false; the call does not throw for these.
- [ ] A caller abort still raises `HemAbortError`.
- [ ] The four facts map from the status result: initialised, `fls_state`
      equal to 0, clock set; a summary flag is true only when all four are.
- [ ] (M1B) a healthy device reports all four true; with the device
      unplugged the call reports unreachable within the time limit.
