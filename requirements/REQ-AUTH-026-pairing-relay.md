---
id: REQ-AUTH-026
title: Pairing through a replaceable relay
status: approved
priority: must
revision: 1
source: start_point §5; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-023", "REQ-AUTH-024", "REQ-AUTH-016"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Pairing through a replaceable relay

The library SHALL provide a pairing operation that runs the device's pairing
calls and a replaceable pairing relay in order, and hands the caller the
data that must be shown to the mobile app.

Default relay, against the Encedo broker, as live-confirmed by [C-SDK]:

| Step | Call | Result |
|---|---|---|
| broker key bound to the device | `POST /session` with `{eid}` | `{epk, exp, paired}` |
| register | `POST /register/init` with `{epk, eid, request}` | `{rid, link}` |
| wait for the app | `GET /register/check/<rid>` | 202 pending; 200 `{pid, reply}` |
| finish | `POST /register/finalise/<rid>` with `{kid, code}` | 200 |

Order: broker key → `ext/init` → register → show the link to the app → wait
→ `ext/validate` → finish.

**Rationale:** Pairing is the precondition for mobile approval. The app
learns the pairing link from a QR code; drawing it is the caller's job, so
the operation returns the data and waits. Introduced in M3.

**Acceptance criteria:**
- [ ] With in-memory fakes for device and relay, the calls happen in the
      stated order and the values are passed on unchanged.
- [ ] The caller receives the link and the device details to display before
      the wait begins.
- [ ] If the final relay step fails, the error names the key id the device
      has already stored, so the caller can remove it.
- [ ] Removing a pairing is a key delete of that key id (REQ-KEY-007).
- [ ] (M3B) attended: a real phone is paired through the default relay and
      then approves a request.
