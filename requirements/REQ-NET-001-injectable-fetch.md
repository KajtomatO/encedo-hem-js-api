---
id: REQ-NET-001
title: Caller-supplied fetch implementation
status: needs-reverify
priority: must
revision: 4
source: start_point G6; user decision 2026-10-07 (Node.js fallback, REQ-NET-013)
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Caller-supplied fetch implementation

The client SHALL send every device request through a `fetch` implementation
supplied by the caller, falling back, when none is supplied, to the
library's own Node.js transport (REQ-NET-013) on Node.js and to the global
`fetch` elsewhere.

**Rationale:** TLS trust for the device certificate, proxies and test
doubles all live in the HTTP layer. Letting the caller pass `fetch` puts
them under the caller's control without the library growing options for
each. Amended 2026-10-07: on Node.js the fallback is not the global `fetch`,
which cannot drive firmware 1.2.2 (ARCHITECTURE.md §6 quirk 18), but the
Node.js transport; a supplied `fetch` is still used for everything.
Introduced in M1.

**Acceptance criteria:**
- [ ] With a supplied `fetch`, the global `fetch` is never called (the test
      replaces the global with one that throws), and neither is the Node.js
      transport.
- [ ] Without one, the global `fetch` is used in a browser, and the Node.js
      transport on Node.js — where the global `fetch` is then never called.
- [ ] The supplied function is called with the standard `(url, init)`
      arguments only.
- [ ] Outside Node.js, if no `fetch` is supplied and none exists globally,
      construction throws `HemUnsupportedError`; on Node.js the built-in
      transport needs no global `fetch`.
- [ ] (M1B) a caller-supplied `fetch` with custom TLS trust reaches the
      device.
