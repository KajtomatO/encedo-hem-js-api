---
id: REQ-TEST-006
title: Test keys carry the EHEMTEST label prefix and are cleaned up
status: verified
priority: must
revision: 3
source: user decision 2026-10-06 (M1B decomposition); https://github.com/KajtomatO/encedo-hem-c-api (same rule and prefix on the same device)
depends_on: ["REQ-TEST-005", "REQ-KEY-001", "REQ-KEY-007"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy"]
---

# Test keys carry the EHEMTEST label prefix and are cleaned up

Tests SHALL confine key creation and deletion on the device to keys whose
label starts with `EHEMTEST`.

**Rationale:** The prefix, reserved on the same device by the C client,
makes test keys recognisable, safely sweepable and distinct from anything
a person created, and the device accumulates nothing between runs.
Introduced in M1B.

**Acceptance criteria:**
- [x] A shared helper produces unique labels `EHEMTEST-<time>-<n>`, records
      every key it creates, and deletes them in teardown — also after a
      failed test body.
- [x] A sweep at the start of the integration run deletes leftover
      `EHEMTEST` keys from interrupted earlier runs (Vitest global setup of
      the device configuration).
- [x] No integration or attended test creates a key with a label outside
      the helper (grep-checkable; enforced by a unit test).
- [ ] No test deletes a key it did not create or sweep by prefix (review
      criterion at the B gate).
- [ ] (M1B) after the full M1B run the device lists no `EHEMTEST` key.
