---
id: REQ-SYS-018
title: Secure-element attestation material
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-017", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Secure-element attestation material

The library SHALL provide a call for `GET /api/system/config/attestation`
that returns the device's attestation material.

**Rationale:** The attestation proof lets a caller, or the vendor backend,
check that the hardware is genuine. A fresh secure element returns a CSR and
a public key; a provisioned one returns its certificate [YAML]. Introduced
in M3.

**Acceptance criteria:**
- [ ] The result contains `genuine`, and `csr`, `key` and `crt` when
      present, with `key` and `crt` as bytes.
- [ ] A 500 with a short non-JSON body raises `HemDeviceError` with the body
      text available (REQ-API-003).
- [ ] The documentation states that the operation needs mass-storage
      hardware.
- [ ] (M3B) the test device returns attestation material.
