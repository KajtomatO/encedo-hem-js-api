---
id: REQ-KEY-004
title: Paged key listing
status: verified
priority: must
revision: 4
source: start_point §3; start_point M1.4; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-KEY-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Paged key listing

The library SHALL provide one paged operation for listing keys that covers
`GET /api/keymgmt/list`, `GET /api/keymgmt/list/{offset}` and `GET
/api/keymgmt/list/{offset}/{count}`.

**Rationale:** The three paths differ only in which parameters are given.
One operation with an offset and a page size is simpler, and the device
never returns more than 15 keys per page [YAML]. Introduced in M1.

**Acceptance criteria:**
- [x] The scope used is `keymgmt:list`; any offset and any count from 1 to
      15 produce a valid request.
- [x] A count above 15, or a negative or non-integer offset, raises
      `HemValidationError`.
- [x] A page contains `offset`, `total`, `listed` and the keys, each with
      `kid`, `type`, `label`, `created`, `updated` and `descr` (bytes) when
      present.
- [x] An iteration helper walks all pages and stops when the offset reaches
      `total` or a page comes back empty — never merely because a page is
      short [C-SDK].
- [x] (M1B) all keys of the test device are listed across at least two
      pages — 2026-10-09: 16 keys, pages of 15 and 1; `listAll` returned all
      16, no duplicates. The device also reported `deleted: 727` (records
      marked deleted, skipped by the listing).
