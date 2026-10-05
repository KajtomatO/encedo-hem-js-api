---
id: STEP-M1A-040
title: Error classes and status mapping
milestone: M1A
implements: ["REQ-API-002", "REQ-API-003"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M1A-020"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The exported error hierarchy of ARCHITECTURE.md §4 exists, and a
response of any status maps to the right class without relying on its body.

**Notes:**
- `src/errors.ts`. Every class of the ARCHITECTURE.md §4 table is defined
  here, including those first raised by later steps (validation, protocol,
  unsupported, approval), so the names are fixed once.
- The mapping takes a `Response` and the operation name. 400, 401, 403, 406,
  409, 412, 413, 418 and 500 each have their own class; any other non-2xx
  status maps to `HemDeviceError` with the raw status kept.
- Body handling: the device sends error responses with an empty body that is
  still labelled `application/json` [YAML] (REQ-API-003). Read the body as
  text; empty means nothing to attach; valid JSON is attached parsed;
  anything else is attached as raw text. No parse exception may escape.
- "A 401 that survives one re-authentication" is session behaviour
  (STEP-M1A-140); here a 401 simply maps to its class.
- Error messages and properties never contain secrets (REQ-API-009); the
  mapping takes only the status, the body and the operation name.

**Definition of done**
- [ ] A `HemError` base class carries a stable `code`, the HTTP `status` when
      a response exists, and the operation name; every subclass of the
      ARCHITECTURE.md §4 table extends it.
- [ ] All classes are exported from the package root and work with
      `instanceof`.
- [ ] A table-driven test with the fake `fetch` shows 400, 401, 403, 406,
      409, 412, 413, 418 and 500 each mapping to its own class.
- [ ] 404, 410 and 411 map to `HemDeviceError` with the raw status preserved.
- [ ] Each error status with an empty body and `Content-Type:
      application/json` maps to its class; no JSON parse exception escapes.
- [ ] A non-JSON error body is available as raw text on the error; a JSON
      error body is exposed parsed.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
