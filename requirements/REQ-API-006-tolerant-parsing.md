---
id: REQ-API-006
title: Tolerant parsing of success responses
status: draft
priority: must
revision: 1
source: ARCHITECTURE.md §6
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Tolerant parsing of success responses

A success response SHALL be accepted when, and only when, it contains every
field the reference marks as required for that operation, regardless of any
additional fields.

**Rationale:** Firmware newer than this library can add fields, and that
must not break callers. A missing required field, on the other hand, means
the reply is not what the binding expects and has to be reported rather than
turned into `undefined` values. Introduced in M1.

**Acceptance criteria:**
- [ ] A response with unknown extra fields is accepted.
- [ ] A response missing a required field raises `HemProtocolError` naming
      the field.
- [ ] A 2xx body that is not valid JSON, for an operation that returns JSON,
      raises `HemProtocolError`.
- [ ] A 200 response with an empty body is accepted by operations whose
      success response is documented as empty.
