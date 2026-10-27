---
id: REQ-NET-007
title: One device request at a time
status: verified
priority: must
revision: 5
source: ARCHITECTURE.md §7; start_point §6 Q5; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
---

# One device request at a time

A client SHALL have at most one device request in flight at a time, sending
queued requests in the order the calls were made.

**Rationale:** The device closes the connection after every response, can
stall under sustained load until it is power-cycled, and has never been
tested with parallel requests [C-SDK]. JavaScript callers produce parallel
calls easily (`Promise.all`), so the client queues them. Introduced in M1.

**Acceptance criteria:**
- [x] With N concurrent calls, `fetch` is invoked for the next request only
      after the previous one has settled and its body was read.
- [x] Requests leave in the order the calls were made.
- [x] A failed request does not block the ones behind it.
- [x] Requests to the cloud relays are not part of this queue.
- [x] (M1B) whether the device handles two parallel requests is probed and
      the finding recorded in ARCHITECTURE.md §11 (Q5) — 2026-10-12: two
      status requests at once, 5 rounds: both answered in ~400 ms every
      time; four at once, 2 rounds: two answered in ~400 ms, the other two
      in ~1 450 ms (about one TCP connect retry later); two logged-in
      clients listing at once, 3 rounds: all ok; no stall
      (tests/attended/parallel.test.ts).
