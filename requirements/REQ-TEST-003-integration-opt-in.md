---
id: REQ-TEST-003
title: Device tests run only when explicitly configured
status: draft
priority: must
revision: 1
source: start_point G22; ARCHITECTURE.md §8
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#1-decisions-fixed"]
---

# Device tests run only when explicitly configured

Tests that contact a real device SHALL run only when the test environment
explicitly provides the device URL, and be reported as skipped otherwise.

**Rationale:** A machine without a device, or CI, must stay green. Nobody
should reach a real HSM by running the default test command. Introduced in
M1B.

**Acceptance criteria:**
- [ ] The default test command runs no test that contacts a device.
- [ ] A separate command runs the integration suite; without the device URL
      variable every such test is skipped, not failed.
- [ ] Device credentials come from environment variables or a git-ignored
      local file, never from a committed file.
- [ ] The library itself reads no environment variable; only the test
      harness does.
- [ ] A requirement defining the test device and what tests are allowed to
      do to it is drafted and approved before the first integration test is
      written (ARCHITECTURE.md §1 D10).
