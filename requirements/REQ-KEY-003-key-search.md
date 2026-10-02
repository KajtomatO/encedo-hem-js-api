---
id: REQ-KEY-003
title: Find keys by description
status: approved
priority: must
revision: 1
source: start_point §3; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005", "REQ-KEY-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Find keys by description

The library SHALL provide a call for `POST /api/keymgmt/search` that finds
keys whose description starts with, ends with or contains given bytes.

On the wire the needle is the base64 of the bytes, with a leading `^` for a
prefix match or a trailing `$` for a suffix match [YAML]. The device matches
it against the base64 text of the stored description [C-SDK].

**Rationale:** Key ids are assigned by the device, so a consumer that
restarts finds its root keys again by the description it gave them.
Introduced in M1.

**Acceptance criteria:**
- [ ] The body is `{descr}` plus `offset` and `limit` when given; the scope
      used is `keymgmt:search`; the result is a page with `total` and the
      matching keys.
- [ ] A needle longer than 64 bytes, or a limit above 15, raises
      `HemValidationError`.
- [ ] No match is an empty result: the device's 200 with an empty list, and
      the 404 of older firmware [C-SDK], both map to it.
- [ ] A helper returns the keys whose description equals given bytes
      exactly, by searching with a prefix and comparing the results.
- [ ] (M1B) a key created with a description is found again by it.
- [ ] (M1B) prefix searches with needles of 1, 2 and 3 bytes are probed and
      the results recorded (ARCHITECTURE.md §11, risk 10).
