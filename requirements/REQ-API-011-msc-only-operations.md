---
id: REQ-API-011
title: Clear error for operations the hardware does not provide
status: draft
priority: must
revision: 1
source: start_point G20; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
---

# Clear error for operations the hardware does not provide

An operation that exists only on hardware with mass storage SHALL fail with
an unsupported-operation error when the device does not provide it.

**Rationale:** The reference marks these operations "MSC build only" [YAML]:
audit-log listing and download, the four storage operations, attestation,
the attestation-certificate write, and firmware and dashboard upload, check
and install. Other builds answer 404 for them [C-SDK], which without
translation looks like a library bug. Introduced in M2.

**Acceptance criteria:**
- [ ] The documentation of each such operation states that it needs
      mass-storage hardware (checked together with REQ-API-007).
- [ ] A 404 from audit-log listing, a storage operation, attestation or an
      upgrade operation raises `HemUnsupportedError`.
- [ ] For audit-log download, where 404 also means an unknown file id
      [YAML], the error states both possible causes.
- [ ] (M2B) the M2 operations of this kind run on the test device, and its
      hardware build is recorded. Behaviour on hardware without mass storage
      stays unverified unless such a device is available.
