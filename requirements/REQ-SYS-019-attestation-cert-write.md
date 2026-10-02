---
id: REQ-SYS-019
title: Write the attestation certificate
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.2; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-012", "REQ-API-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Write the attestation certificate

The library SHALL provide a dedicated call for `POST
/api/system/config/provisioning` that writes the attestation certificate
into the secure element.

**Rationale:** This is a one-shot factory step: it works only on an
uninitialised device that holds no certificate yet, and cannot be repeated
[YAML]. It is therefore a call of its own (REQ-API-012). Introduced in M3.

**Acceptance criteria:**
- [ ] The body is `{genuine, crt}`; no `Authorization` header is sent.
- [ ] A 403 (device already initialised) raises `HemForbiddenError`; a 406
      (already provisioned, key mismatch or write failure) raises
      `HemOperationFailedError`.
- [ ] The call is never repeated automatically.
- [ ] (M3B) not exercised unless the user provides a device in factory state
      and decides to.
