---
id: REQ-API-002
title: Typed errors that identify the cause of a failure
status: draft
priority: must
revision: 1
source: start_point G14; ARCHITECTURE.md §4; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
---

# Typed errors that identify the cause of a failure

Every failure of a public operation SHALL be reported as an instance of an
exported error class that identifies its cause, with distinct classes for at
least: bad request (400), unauthenticated (401), forbidden (403), operation
refused or failed (406), device busy or wrong state (409), origin rejected
(412), payload too large (413), TLS required (418), device error (500),
timeout, and device unreachable.

**Rationale:** A consumer such as a key provider has to react differently to
a wrong credential, a busy device and a dead network; it can only do that if
the library tells them apart. The status meanings are those of [YAML].
Introduced in M1.

**Acceptance criteria:**
- [ ] A table-driven unit test with a substituted `fetch` shows each status
      in the list mapping to its own class.
- [ ] All classes extend one exported base class that carries a stable
      `code`, the HTTP `status` when a response exists, and the name of the
      operation.
- [ ] A status outside the list (for example 404, 410, 411) maps to the
      device-error class with the raw status preserved.
- [ ] The classes are exported from the package root and work with
      `instanceof`.
- [ ] (M1B) 401, 403 and 406 are each provoked on the real device and map as
      specified.
