---
id: REQ-SYS-010
title: Paged audit-log listing
status: approved
priority: must
revision: 1
source: start_point §4; start_point M2.4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Paged audit-log listing

The library SHALL provide one paged operation for listing audit-log file ids
that covers both `GET /api/logger/list` and `GET /api/logger/list/{offset}`.

**Rationale:** The two paths differ only in whether an offset is given. One
operation with an offset parameter is easier to use and to iterate.
Introduced in M2.

**Acceptance criteria:**
- [ ] The scope used is `logger:get`; an offset of zero and a non-zero
      offset each produce a valid request.
- [ ] The result contains `total` and the list of ids; ids are 8 lower-case
      hex characters.
- [ ] The documentation states that `total` counts all entries in the log
      directory, not the page [YAML], and that the operation needs
      mass-storage hardware.
- [ ] A negative or non-integer offset raises `HemValidationError`.
- [ ] (M2B) the log files of the test device are listed.
