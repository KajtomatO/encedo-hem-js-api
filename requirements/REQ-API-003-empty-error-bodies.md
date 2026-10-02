---
id: REQ-API-003
title: Error mapping independent of the response body
status: draft
priority: must
revision: 1
source: start_point G15; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#2-context--constraints"]
---

# Error mapping independent of the response body

Error mapping SHALL NOT depend on the presence or format of a response body.

**Rationale:** The device sends error responses with an empty body while
still labelling them `application/json` [YAML]. A client that tries to parse
them fails with a parse error that hides the real status. Introduced in M1.

**Acceptance criteria:**
- [ ] Each error status with an empty body and `Content-Type:
      application/json` maps to its error class; no JSON parse exception
      escapes.
- [ ] An error response with a non-JSON body maps to its error class, and
      the raw body text is available on the error.
- [ ] An error response with a JSON body exposes the parsed body on the
      error.
- [ ] (M1B) error responses from the real device are confirmed to have empty
      bodies and to map correctly.
