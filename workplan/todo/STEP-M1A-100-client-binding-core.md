---
id: STEP-M1A-100
title: HemClient, binding core, status and version
milestone: M1A
implements: ["REQ-API-001", "REQ-API-006", "REQ-SYS-001", "REQ-SYS-002", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#3-component-overview"]
depends_on: ["STEP-M1A-050", "STEP-M1A-090"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `new HemClient({ url, fetch })` exists, and `client.system.status()`
and `client.system.version()` return typed results through one shared
binding pipeline: validate, serialise, send, parse tolerantly, map errors.

**Notes:**
- `src/client.ts`, `src/api/system.ts`, and the binding core shared by all
  API groups.
- Describe each operation as data — name, method, path, token scope or none,
  TLS-only flag, required response fields — so the table-driven checks of
  STEP-M1A-230 can walk every operation.
- Construction performs no network and no cryptographic work; all state
  lives in the instance (REQ-API-001).
- A serialised JSON body over 7300 bytes is rejected before sending
  (REQ-API-005, using the validator of STEP-M1A-050).
- Tolerant parsing per REQ-API-006. No M1 operation has an empty success
  response, so that criterion is tested through the binding core with a
  test-only operation description.
- Status: the device omits fields instead of sending defaults [YAML]; the
  full list is in REQ-SYS-001. The result carries explicit values.
- Version: `fwk`, `fws` and the other binary fields are returned as bytes
  (REQ-SYS-002, REQ-API-004).
- Neither operation needs a token; no `Authorization` header is sent.
- TSDoc on both operations states scope none and milestone M1; the automated
  check for that arrives in STEP-M1A-220.
- Closed elsewhere: REQ-API-001 "two clients do not share tokens or
  credentials" in STEP-M1A-130 (listed there). Partly closed here:
  REQ-API-005 (the body limit).

**Definition of done**
- [ ] Constructing a client with a valid URL and a substituted `fetch` makes
      zero `fetch` calls.
- [ ] Constructing without a URL, or with a scheme that is neither `http:`
      nor `https:`, throws `HemValidationError`.
- [ ] Two clients in one test have separate request queues, and no exported
      function changes the behaviour of an already constructed client.
- [ ] Binding core: unknown extra response fields are accepted; a missing
      required field raises `HemProtocolError` naming the field; a 2xx body
      that is not valid JSON raises `HemProtocolError`; an empty 200 is
      accepted where the success response is documented as empty.
- [ ] A serialised JSON body over 7300 bytes raises `HemValidationError` with
      zero `fetch` calls; a body of exactly 7300 bytes is sent.
- [ ] `system.status()`: no `Authorization` header; `ctx`, `uptime`, `temp`
      and `fls_state` are required; initialised is true unless `inited` is
      false; clock-set is true exactly when `ts` or `time` is present;
      `storage` and `format` are passed through when present.
- [ ] `system.version()`: no `Authorization` header; `hwv` and `fwv` as
      strings, `fwk` and `fws` as bytes; `blv`, `blk`, `bls`, `sd_csd`,
      `sd_cid` and `uis` included when the device sends them.
- [ ] Both operations have unit tests asserting method, path, headers, body
      and response mapping, and TSDoc stating scope and milestone.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
