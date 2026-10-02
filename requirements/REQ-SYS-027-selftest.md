---
id: REQ-SYS-027
title: Run the self-test suite
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-SYS-017", "REQ-API-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Run the self-test suite

The library SHALL provide a call for `GET /api/system/selftest` that runs
the device's self-tests and returns their results.

**Rationale:** The self-test re-runs every check and updates the latched
fault state that the status call reports; it also returns key-repository
statistics [YAML]. It is not cheap: about 5 seconds [C-SDK]. Introduced in
M3.

**Acceptance criteria:**
- [ ] Any valid token is accepted by the device; the library uses
      `system:config`.
- [ ] The result contains `fls_state`, `selftest_ts` and `repo_stats`
      (`total`, `deleted`, `invalid`, `fragmented`, `freeslots`), plus the
      optional fields when present.
- [ ] (M3B) the self-test runs on the test device; its duration is recorded.
