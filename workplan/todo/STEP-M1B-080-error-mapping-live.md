---
id: STEP-M1B-080
title: Error mapping on the device — 401, 403, 406, empty bodies
milestone: M1B
implements: ["REQ-API-002", "REQ-API-003"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1B-070"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** 401, 403 and 406 are each provoked on the real device and map to
the specified error classes; the device's error responses are confirmed to
have empty bodies.

**Notes:**
- B step: state and stop first. What it does to the device: a few
  deliberately failing requests (wrong passphrase, wrong-scope token,
  operations on a missing key) and a short-lived `EHEMTEST` key.
- 401: a wrong passphrase (REQ-AUTH-001's run) and a bearer altered by the
  test on a protected endpoint — a present, invalid token is rejected
  before routing [YAML].
- 403: a token for a broader scope used on a crypto operation [C-SDK]. The
  library never does this itself, so the test sends that request directly
  through the transport with a token obtained by a normal login.
- 406: delete of a missing key (STEP-M1B-060) and unwrap of altered input
  (STEP-M1B-070) — reuse those findings, confirm the class.
- REQ-API-003: a recording `fetch` captures the raw responses — bodies
  empty, mapping unaffected.

**Definition of done**
- [ ] 401 → `HemUnauthenticatedError` after one re-authentication; 403 →
      `HemForbiddenError`; 406 → `HemOperationFailedError`, each provoked
      live (REQ-API-002).
- [ ] The captured error responses have empty bodies and map correctly
      (REQ-API-003).
- [ ] Integration tests tagged `verifies:`; findings next to the boxes.
