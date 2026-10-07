---
id: REQ-TEST-001
title: Unit tests run without a device
status: verified
priority: must
revision: 8
source: start_point G21; user decision 2026-10-07 (Node transport guard, REQ-NET-013)
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
to run anywhere, including CI, where no device exists. Amended 2026-10-07:
since the Node.js transport (REQ-NET-013) bypasses `fetch`, the Node run
guards that path too. Introduced in M1.

**Acceptance criteria:**
- [x] The test setup replaces the global `fetch` with one that fails the
      test, so an unsubstituted request cannot go unnoticed.
- [x] In the Node run the setup also blocks `node:https` and `node:http`
      requests to anything but the loopback address, so a client built
      without a `fetch` cannot reach the network from a unit test
      (`tests/support/setup.node.ts`; proven by the guard fixture run).
- [x] A shared fake-`fetch` module lives in `tests/support/` and is tagged
      `supports:`.
- [x] Every binding has at least one unit test asserting the request's
      method, path, headers and body, and the mapping of its response.
- [x] The suite passes on a machine with networking disabled.
