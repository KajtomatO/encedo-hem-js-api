---
id: REQ-NET-001
title: Caller-supplied fetch implementation
status: draft
priority: must
revision: 1
source: start_point G6
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Caller-supplied fetch implementation

The client SHALL send every device request through a `fetch` implementation
supplied by the caller, falling back to the global `fetch` when none is
supplied.

**Rationale:** TLS trust for the device certificate, proxies and test
doubles all live in the HTTP layer. Letting the caller pass `fetch` puts
them under the caller's control without the library growing options for
each. Introduced in M1.

**Acceptance criteria:**
- [ ] With a supplied `fetch`, the global `fetch` is never called (the test
      replaces the global with one that throws).
- [ ] Without one, the global `fetch` is used.
- [ ] The supplied function is called with the standard `(url, init)`
      arguments only.
- [ ] If no `fetch` is supplied and none exists globally, construction
      throws `HemUnsupportedError`.
- [ ] (M1B) a caller-supplied `fetch` with custom TLS trust reaches the
      device.
