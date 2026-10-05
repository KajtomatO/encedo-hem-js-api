---
id: STEP-M1A-210
title: Mobile approval as login mode
milestone: M1A
implements: ["REQ-AUTH-019", "REQ-AUTH-016"]
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#52-session-behaviour"]
depends_on: ["STEP-M1A-140", "STEP-M1A-200"]
evidence:
  commits: ["99c80aa"]
  tests: ["verifies: REQ-AUTH-019 (tests/unit/mobile-login.test.ts)", "verifies: REQ-AUTH-016 (tests/unit/mobile-login.test.ts)"]
  notes: "npm run check: 48 files, 974 tests passed in Node v24.21.0 and headless Chromium. Client option mobileApproval (true or { timeoutMs, intervalMs, note, ctx }); the session's token source becomes the approval engine, so cache, renewal, the 401 retry and shared acquisition apply unchanged. Giving both passphrase and mobileApproval raises HemValidationError (parameter mobileApproval). The option's TSDoc passes on the C-SDK observations (15-minute tokens, one push per key scope) as unconfirmed until M1B."
reopened: []
cancelled: null
---

**Goal:** A client configured for mobile approval instead of a passphrase
gets every token it needs through the approval engine, and the rest of the
API works unchanged.

**Notes:**
- "Obtain a token for this scope" becomes a choice inside the session
  engine: passphrase login (STEP-M1A-120) or approval (STEP-M1A-200). The
  cache, renewal, the 401 retry and the shared acquisition (STEP-M1A-130,
  STEP-M1A-140) apply to both.
- A client has either a passphrase or mobile mode; giving both is rejected
  at construction.
- A 401 on a token obtained by approval leads to one new approval and one
  repeated call, like REQ-AUTH-008.
- The option's TSDoc passes on what [C-SDK] recorded with the real Encedo
  app — tokens lived 15 minutes, and a `keymgmt:use:<kid>` scope means one
  push per key — and says these are observations to be confirmed in M1B.
- Partly closed here: REQ-AUTH-016 (relay set to none, for mobile login
  mode).

**Definition of done**
- [x] On a mobile-mode client with an empty cache, an authenticated call
      triggers one approval for that operation's scope and then proceeds.
- [x] While the token is valid, further calls for that scope cause no new
      approval.
- [x] A client has either a passphrase or mobile mode, not both; configuring
      both is rejected.
- [x] A 401 on a token obtained this way leads to one new approval and one
      repeated call.
- [x] With the relay set to none, a mobile-mode client raises
      `HemUnsupportedError`.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
