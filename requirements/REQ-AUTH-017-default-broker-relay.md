---
id: REQ-AUTH-017
title: Default approval relay for the Encedo broker
status: draft
priority: must
revision: 1
source: user decision 2026-10-02; start_point §6 Q2; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-016"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Default approval relay for the Encedo broker

The library SHALL ship a default approval relay that uses the Encedo
notification broker at `https://api.encedo.com/notify`.

Broker calls, all unauthenticated, as reconstructed and live-confirmed by
[C-SDK]:

| Relay operation | Broker call | Result |
|---|---|---|
| obtain key | `GET /session` | `{epk, exp}` |
| submit | `POST /event/new` with `{authreq, epk}` | `{eventid, …}` |
| check | `GET /event/check/<eventid>` | 202 pending; 200 `{"deny":true}` rejected; 200 `{authreply, …}` approved; 404 unknown or expired |

**Rationale:** The device never talks to the phones; the broker is the only
path to them [C-SDK]. Shipping the relay makes mobile approval work out of
the box, and the hardware verification needs it anyway. The broker API is
undocumented and can change without notice, which is why it sits behind the
interface of REQ-AUTH-016. Introduced in M1.

**Acceptance criteria:**
- [ ] Each relay operation makes the broker call in the table and maps the
      responses as stated.
- [ ] Any other broker status raises an error carrying the status and the
      body.
- [ ] The relay uses its own `fetch` (the global one by default), never the
      device `fetch`; the base URL is configurable.
- [ ] (M1B) attended: against the real broker, the session call succeeds, a
      submitted request produces a push on the paired phone, and the check
      call is seen pending and then final.
- [ ] (M1B) whether the broker accepts requests from a browser origin is
      recorded (ARCHITECTURE.md §11, risk 11).
