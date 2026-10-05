---
id: STEP-M1A-170
title: Key search and paged listing
milestone: M1A
implements: ["REQ-KEY-003", "REQ-KEY-004"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-160"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.keys.search()` finds keys by description, `client.keys.list()`
pages through all keys behind one call, and each has a helper for the common
case: exact-description lookup and walking every page.

**Notes:**
- Search: `POST /api/keymgmt/search`, scope `keymgmt:search`. On the wire
  the needle is the base64 of the bytes, with a leading `^` for a prefix
  match or a trailing `$` for a suffix match [YAML]; the device matches it
  against the base64 text of the stored description [C-SDK]
  (ARCHITECTURE.md §6 quirk 8).
- No match is an empty result: a 200 with an empty list, and the 404 of
  older firmware [C-SDK]. The 404 mapping belongs to search only.
- Exact-match helper: search with a prefix, then compare the returned
  descriptions byte for byte.
- ARCHITECTURE.md §11 risk 10 — a prefix whose length is not a multiple of
  three may not match as expected — is an inference, not a recorded fact,
  and is probed in M1B. Do not build a workaround for it here; state the
  open point in the TSDoc of search.
- List: one operation over `GET /api/keymgmt/list`, `/list/{offset}` and
  `/list/{offset}/{count}`, scope `keymgmt:list`, at most 15 keys per page
  [YAML].
- Iteration helper: stop when the offset reaches `total` or a page comes
  back empty — never merely because a page is short [C-SDK].
- Type strings go through the parser of STEP-M1A-160. Both operations are
  TLS-only (REQ-NET-003).

**Definition of done**
- [ ] Search: the body is `{descr}` plus `offset` and `limit` when given; the
      scope used is `keymgmt:search`; the result is a page with `total` and
      the matching keys.
- [ ] Search: prefix, suffix and contains needles are sent as base64 with a
      leading `^`, a trailing `$`, or neither.
- [ ] Search: a needle longer than 64 bytes, or a limit above 15, raises
      `HemValidationError`.
- [ ] Search: a 200 with an empty list and a 404 both give an empty result.
- [ ] A helper returns the keys whose description equals given bytes exactly,
      by searching with a prefix and comparing the results.
- [ ] List: the scope used is `keymgmt:list`; any offset and any count from 1
      to 15 produce a valid request on the matching path.
- [ ] List: a count above 15, or a negative or non-integer offset, raises
      `HemValidationError`.
- [ ] List: a page contains `offset`, `total`, `listed` and the keys, each
      with `kid`, `type`, `label`, `created`, `updated` and `descr` (bytes)
      when present.
- [ ] The iteration helper walks all pages and stops when the offset reaches
      `total` or a page comes back empty, not when a page is short.
- [ ] Both operations raise `HemTlsRequiredError` on an `http:` client with
      zero `fetch` calls.
- [ ] Each operation has unit tests asserting method, path, headers, body and
      response mapping, and TSDoc stating scope and milestone.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
