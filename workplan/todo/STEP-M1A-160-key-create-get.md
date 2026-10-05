---
id: STEP-M1A-160
title: Key create, key get, key-type parsing
milestone: M1A
implements: ["REQ-KEY-001", "REQ-KEY-002", "REQ-KEY-005", "REQ-AUTH-010"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-130"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.keys.create()` and `client.keys.get()` work against a
substituted `fetch` with the right scopes, and a key's type string is
presented as flags plus an algorithm name.

**Notes:**
- `src/api/keymgmt.ts`. These are the first real authenticated bindings, so
  they also exercise the session engine end to end.
- Create: `POST /api/keymgmt/create`, scope `keymgmt:gen`. The key types
  and the three mode literals are listed in REQ-KEY-001 from [YAML]. The
  mode literals are exact — `ExDSA,ECDH` is rejected by the device [C-SDK] —
  so the mode is validated against the three literals, not normalised.
- Create TSDoc: a `SECP*` key is ECDH-only unless the mode asks for `ExDSA`
  (ARCHITECTURE.md §6 quirk 11), and key generation for post-quantum types
  can exceed the default time limit (ARCHITECTURE.md §7), so the per-call
  limit is mentioned.
- Get: `GET /api/keymgmt/get/{kid}`, scope `keymgmt:use:<kid>` with the key
  id in lower case. On firmware 1.2.2 the reply carries neither the label
  nor, in practice, the description [C-SDK] (quirk 7); the TSDoc says to
  read them through list or search and states the public-key formats from
  [YAML].
- Type parsing (REQ-KEY-005): list and search return comma-joined tokens
  [YAML]; key get returns a bare algorithm name for asymmetric keys
  [C-SDK]. Both forms parse; an unknown token is kept, not rejected.
- Both operations are TLS-only (REQ-NET-003).
- Partly closed here: REQ-AUTH-010 (a master session's 403 on a key
  operation).

**Definition of done**
- [ ] Create: the body is `{label, type}` plus `mode` and `descr` (base64)
      when given; the scope used is `keymgmt:gen`; the result is the key id.
- [ ] Create: a type outside the list, or a mode outside the three literals,
      raises `HemValidationError`; label and description limits are enforced
      per REQ-API-005.
- [ ] Create: the TSDoc states the default mode of `SECP*` keys.
- [ ] Get: the scope used is `keymgmt:use:<kid>` with a lower-case key id;
      the result contains `updated`, and `type`, `pubkey` (bytes), `der`
      (bytes) and `descr` (bytes) when present.
- [ ] Get: a 406 raises `HemOperationFailedError`; the TSDoc states the
      public-key formats and that label and description are read through
      list or search.
- [ ] Type parsing: the flags `ATT`, `PKEY`, `ECDH`, `ExDSA`, `CERT` and
      `PQC` and every algorithm name of the reference are recognised; a bare
      algorithm name parses to that algorithm with no flags; an unknown token
      raises no error and the original string stays available.
- [ ] A master-role session that calls a key operation gets the device's 403
      as `HemForbiddenError`.
- [ ] Both operations raise `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] Each operation has unit tests asserting method, path, headers, body and
      response mapping, and TSDoc stating scope and milestone.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
