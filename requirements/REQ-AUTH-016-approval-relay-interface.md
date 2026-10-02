---
id: REQ-AUTH-016
title: Replaceable approval relay
status: draft
priority: must
revision: 1
source: start_point M1.2; user decision 2026-10-02
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#53-mobile-approval", "ARCHITECTURE.md#3-component-overview"]
---

# Replaceable approval relay

The component that carries an authorization request to the mobile app and
the app's reply back SHALL be replaceable by the caller through a documented
interface.

**Rationale:** The path between the client and the phone is outside the
device API and outside this project's control. A consumer may need to route
it through its own infrastructure, or to cut it off entirely. Introduced in
M1.

**Acceptance criteria:**
- [ ] An interface is exported with three operations: obtain the key to use
      as `epk`; submit an authorization request; check for the outcome
      (pending, approved with the reply, rejected, or expired).
- [ ] The client accepts any implementation of it as an option.
- [ ] A unit test completes an approval with an in-memory relay and makes no
      request to `api.encedo.com`.
- [ ] With the relay set to none, the approval engine and mobile login mode
      raise `HemUnsupportedError`, while the two device calls (REQ-AUTH-014,
      REQ-AUTH-015) still work.
