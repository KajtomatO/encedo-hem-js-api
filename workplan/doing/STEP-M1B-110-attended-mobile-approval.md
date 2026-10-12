---
id: STEP-M1B-110
title: Attended — mobile approval on the real phone
milestone: M1B
implements: ["REQ-AUTH-014", "REQ-AUTH-015", "REQ-AUTH-017", "REQ-AUTH-018", "REQ-AUTH-019", "REQ-AUTH-020"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-070"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The mobile-approval flow works end to end with the paired phone:
approved, rejected and timed out are three distinct outcomes; mobile-login
mode completes an HMAC. Re-verifies Q2 (§11) with this library.

**Notes:**
- Attended under `tests/attended/`: every request pushes a notification to
  the user's phone. State the sequence and stop before starting. Needs two
  `EHEMTEST` keys (helper).
- Sequence:
  1. `requestApproval` for `keymgmt:list` → the device returns an
     authorization request (REQ-AUTH-014);
  2. default relay: session call succeeds, submit produces a push, check is
     seen pending and then final (REQ-AUTH-017, broker half; the
     browser-origin half is STEP-M1B-120);
  3. approve on the phone → the token is accepted by the device (`list`
     works); its lifetime recorded — [C-SDK] saw 15 minutes with the Encedo
     app (REQ-AUTH-015);
  4. reject → `HemApprovalRejectedError`; ignore → `HemApprovalTimeoutError`
     after the wait (REQ-AUTH-018);
  5. a client in mobile-login mode: HMAC on one key after approval; a call
     on a second key — count the pushes (REQ-AUTH-019; [C-SDK] reports one
     per key scope);
  6. drift: if the broker rejects a request because the device clock is
     ahead, record it and whether one check-in plus a fresh request clears
     it (REQ-AUTH-020). Opportunistic — "not observed" is a valid finding.

**Definition of done**
- [ ] Authorization request returned for `keymgmt:list` (REQ-AUTH-014).
- [ ] Real broker: session, push, pending then final (REQ-AUTH-017).
- [ ] Approved token accepted; lifetime recorded (REQ-AUTH-015).
- [ ] Approve, reject and ignore produce the three outcomes (REQ-AUTH-018).
- [ ] HMAC completes in mobile-login mode; pushes for two keys counted
      (REQ-AUTH-019).
- [ ] Drift rejection and recovery observed or recorded as not observed
      (REQ-AUTH-020).
- [ ] The attended test prints each action, skips without the opt-in, and
      is tagged `verifies:`; findings next to the boxes.
