---
id: STEP-M1B-060
title: Keys live — create, get, search, list, delete, limits
milestone: M1B
implements: ["REQ-KEY-001", "REQ-KEY-002", "REQ-KEY-003", "REQ-KEY-004", "REQ-KEY-005", "REQ-KEY-007", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1B-050"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** Every M1 key operation, plus delete, runs live on `EHEMTEST` keys;
the documented limits and the two key probes are recorded.

**Notes:**
- B step: state and stop first. What it does to the device: creates up to
  about 17 `EHEMTEST` keys (a two-page listing needs at least 16 keys on the
  device — count the existing ones and create only the difference), reads,
  searches and lists them, and deletes every one of them at the end.
- REQ-KEY-001: an `AES256` and a `SHA2-256` key appear in the list.
- REQ-KEY-002: `get` fields recorded — expect no label, and no description
  on this firmware (§6 quirk 7).
- REQ-KEY-003: a key with a description is found by it; prefix needles of
  1, 2 and 3 bytes probed and recorded (§11 risk 10 — base64 alignment).
- REQ-KEY-004: all keys listed across at least two pages.
- REQ-KEY-005: the type string of every key on the device parses; any
  token not in the reference recorded.
- REQ-API-005: a 32-character label and a 64-byte description come back
  unchanged. Do not send 65 bytes (§6 quirk 6 — accepted, then truncated).
- REQ-KEY-007: a deleted key no longer appears in the list; a second delete
  answers 406 → `HemOperationFailedError` (also feeds STEP-M1B-080).
- Scope findings for REQ-AUTH-005 are closed in STEP-M1B-070.

**Definition of done**
- [ ] `AES256` and `SHA2-256` keys created and listed (REQ-KEY-001).
- [ ] A created key read back; the returned fields recorded (REQ-KEY-002).
- [ ] Found by description; 1/2/3-byte prefix probe recorded (REQ-KEY-003).
- [ ] Listing across at least two pages (REQ-KEY-004).
- [ ] Every key's type string parses; unknown tokens recorded (REQ-KEY-005).
- [ ] 32-character label and 64-byte description round-trip unchanged
      (REQ-API-005).
- [ ] Delete removes the key from the list; a repeat delete maps to
      `HemOperationFailedError` (REQ-KEY-007).
- [ ] No `EHEMTEST` key remains after the run; the protected set is
      untouched (REQ-TEST-005/006 evidence for the gate).
- [ ] Integration tests tagged `verifies:`; findings next to the boxes.
