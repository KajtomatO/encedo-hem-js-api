---
id: REQ-TEST-001
title: Unit tests run without a device
status: draft
priority: must
revision: 1
source: start_point G21
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout"]
---

# Unit tests run without a device

The unit test suite SHALL run to completion without a device and without
network access, using a substituted `fetch`.

**Rationale:** Unit tests are the whole verification of an A part. They have
to run anywhere, including CI, where no device exists. Introduced in M1.

**Acceptance criteria:**
- [ ] The test setup replaces the global `fetch` with one that fails the
      test, so an unsubstituted request cannot go unnoticed.
- [ ] A shared fake-`fetch` module lives in `tests/support/` and is tagged
      `supports:`.
- [ ] Every binding has at least one unit test asserting the request's
      method, path, headers and body, and the mapping of its response.
- [ ] The suite passes on a machine with networking disabled.
