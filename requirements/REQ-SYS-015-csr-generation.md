---
id: REQ-SYS-015
title: Certificate signing request
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Certificate signing request

The library SHALL provide a call that makes the device generate a
certificate signing request through `POST /api/system/config`.

**Rationale:** A caller that wants its own certificate authority to issue
the device certificate needs the device's CSR. Introduced in M3.

**Acceptance criteria:**
- [ ] The request carries `gen_csr` set to true; the result contains the
      `csr`.
- [ ] A success reply without `csr` raises `HemProtocolError`.
- [ ] The call cannot be combined with a TLS import, because the device
      ignores `gen_csr` in that case [YAML].
- [ ] (M3B) the test device returns a CSR.
