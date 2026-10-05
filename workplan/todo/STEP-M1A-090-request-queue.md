---
id: STEP-M1A-090
title: Transport — request queue and pacing
milestone: M1A
implements: ["REQ-NET-007", "REQ-NET-008", "REQ-NET-005"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1A-080"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** A client has at most one device request in flight, sends queued
requests in the order the calls were made, and can keep a minimum interval
between the starts of consecutive requests.

**Notes:**
- The queue belongs to one transport instance; there is no module-level
  state (REQ-API-001).
- The next request starts only after the previous one has settled and its
  body was read. The reasons — connection closed after every response,
  stalls under load, parallel requests untested — are recorded by [C-SDK]
  and cited in REQ-NET-007.
- A waiting call whose signal fires is removed from the queue and never
  sent (REQ-NET-005, third criterion).
- The time limit of REQ-NET-004 is applied per request, so it runs from the
  moment a request is sent, not from the moment it was queued. This reading
  follows the REQ's fourth criterion ("each request, not the sum"); say so
  in the TSDoc of the timeout option.
- Pacing: a minimum interval between request starts; the default of zero
  schedules no timer at all.
- Closed elsewhere: REQ-NET-007 "relay requests are not part of this queue"
  in STEP-M1A-110; REQ-NET-008 "also applies to retried requests" in
  STEP-M1A-140. Both REQs are listed there too.

**Definition of done**
- [ ] With N concurrent calls, `fetch` is invoked for the next request only
      after the previous one has settled and its body was read.
- [ ] Requests leave in the order the calls were made.
- [ ] A failed request does not block the ones behind it.
- [ ] Aborting a call that is still waiting in the queue removes it; it is
      never sent.
- [ ] The default interval is zero and adds no delay.
- [ ] With an interval of 150 ms and fake timers, consecutive requests start
      at least 150 ms apart.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
