---
id: REQ-SYS-012
title: Change device configuration
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-012", "REQ-API-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Change device configuration

The library SHALL provide a call for `POST /api/system/config` that changes
the device's general settings.

General settings [YAML]: `user`, `email`, `origin`, `trusted_ts`,
`trusted_backend`, `allow_keysearch`, `ctx`, `http_option_hsts`,
`http_option_dosprot_mode`, and on mass-storage hardware `dnsd`,
`storage_mode`, `storage_disk0size`. User-key rotation, TLS import, CSR
generation and wipe use the same endpoint but have their own calls
(REQ-SYS-013 to REQ-SYS-016).

**Rationale:** Administering a device after provisioning means changing
these settings. Keeping the dangerous uses of the endpoint out of this call
is what REQ-API-012 requires. Introduced in M3.

**Acceptance criteria:**
- [ ] The scope used is `system:config`; only the given settings are sent.
- [ ] The result contains `updated`, and `reboot_required` when present.
- [ ] A 400 whose body has the shape of the success response [YAML] exposes
      that body on the error.
- [ ] The documentation warns that changing `storage_disk0size` reformats
      the storage [YAML].
- [ ] (M3B) a setting chosen by the user is changed on the device and
      restored.
