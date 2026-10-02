---
id: REQ-SYS-017
title: Operations that work with and without a token
status: draft
priority: must
revision: 1
source: start_point M3.1; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-001", "REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Operations that work with and without a token

An operation that the reference marks as unauthenticated on a factory-fresh
device and authenticated afterwards SHALL work in both states.

These are [YAML]: configuration write, attestation, self-test, reboot, USB
mode, and firmware and dashboard upload, check and install. Shutdown is not
among them: it always needs a token.

**Rationale:** Before provisioning there is no key to log in with, so asking
for a token would make these operations unusable exactly when a fresh device
needs them. Introduced in M3.

**Acceptance criteria:**
- [ ] When the device reports itself as not initialised, these operations
      are sent without an `Authorization` header and no login is attempted.
- [ ] On an initialised device they are sent with a token of their scope.
- [ ] Shutdown always uses a token.
- [ ] (M3B) attended, only if a factory-fresh device is available: one such
      operation is run in each state.
