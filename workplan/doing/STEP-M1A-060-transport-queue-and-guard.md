---
id: STEP-M1A-060
title: Transport queue, pacing and HTTPS guard
milestone: M1A
implements: ["REQ-NET-003", "REQ-NET-007", "REQ-NET-008"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-050"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** A transport instance has at most one device request in flight,
sends queued requests in call order with an optional minimum interval
between starts, and refuses `requiresTls` requests before sending when the
device URL is not `https:`.

**Notes:** The queue belongs to one client instance; relay traffic never
enters it (relays use their own `fetch`, STEP-M1A-120 and STEP-M1A-160). A
failed request does not block the next; aborting a queued call removes it.
Pacing defaults to zero and also applies to retried requests. A 418 from
the device maps to `HemTlsRequiredError` (mapping from STEP-M1A-030,
asserted here). Quirk 1 of ARCHITECTURE.md §6 (409 instead of 418 on some
endpoints) is moot because the guard refuses first.

**Definition of done**
- [ ] With N concurrent calls, `fetch` for the next request starts only after the previous one settled and its body was read; requests leave in call order
- [ ] A failed request does not block the ones behind it
- [ ] Aborting a queued call removes it and it is never sent; other queued calls proceed
- [ ] The default interval is zero and adds no delay; with 150 ms and fake timers consecutive starts are at least 150 ms apart, retried requests included
- [ ] A `requiresTls` request on an `http:` transport raises `HemTlsRequiredError` with zero `fetch` calls; other requests on `http:` are sent
- [ ] A 418 response raises `HemTlsRequiredError`
