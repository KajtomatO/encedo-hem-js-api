---
id: STEP-M1B-070
title: HMAC, wrap and unwrap live; one per-key token for get and crypto
milestone: M1B
implements: ["REQ-OPS-001", "REQ-OPS-002", "REQ-OPS-003", "REQ-AUTH-005"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#52-session-behaviour"]
depends_on: ["STEP-M1B-060"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** HMAC with a stored `SHA2-256` key, and wrap/unwrap with a stored
`AES256` key, run live; one `keymgmt:use:<kid>` token serves both `get` and
a crypto operation on that key.

**Notes:**
- B step: state and stop first. What it does to the device: creates two
  `EHEMTEST` keys, runs HMAC, wrap and unwrap on them, deletes them.
- REQ-OPS-001: the HMAC is 32 bytes and identical for the same message
  twice; `alg` is not sent in stored-key mode (§6 quirk 10).
- REQ-OPS-002: a 32-byte key wraps to 40 bytes. REQ-OPS-003: unwrapping
  returns the original 32 bytes; unwrapping altered input fails — record
  the status (expected 406; feeds STEP-M1B-080).
- REQ-AUTH-005: with a counting `fetch`, `get` then `hmac` on the same kid
  cause exactly one `POST /api/auth/token`, for scope `keymgmt:use:<kid>`.
  The "each M1 operation is accepted with the scope the library chose" half
  is settled by the integration suite as a whole — summarise in the finding
  which scope each operation used.

**Definition of done**
- [ ] HMAC: 32 bytes, deterministic (REQ-OPS-001).
- [ ] Wrap: 32-byte key → 40 bytes (REQ-OPS-002).
- [ ] Unwrap: original bytes back; altered input fails with the recorded
      status (REQ-OPS-003).
- [ ] One per-key token serves `get` and a crypto call; every M1 operation
      accepted with the library's scope, listed in the finding
      (REQ-AUTH-005).
- [ ] Integration tests tagged `verifies:`; findings next to the boxes.
