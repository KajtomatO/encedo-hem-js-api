---
id: REQ-SYS-014
title: TLS certificate and key import
status: approved
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
---

# TLS certificate and key import

The library SHALL provide a call that imports TLS material into the device
through `POST /api/system/config`.

**Rationale:** This is the working way to renew the device certificate:
firmware 1.2.2 does not install certificates delivered by check-in, while a
certificate chain sent as `tls.crt` followed by a reboot takes effect
[C-SDK]. A full bundle (`emp`, `key`, `crt`) restores TLS on a device that
has none [YAML]. Introduced in M3.

**Acceptance criteria:**
- [ ] A certificate chain alone is sent as `{tls: {crt}}`; a full bundle as
      `{tls: {emp, key, crt}}`.
- [ ] The result reports `reboot_required`.
- [ ] The call works on an `http:` client, since a device without TLS
      material serves only plain HTTP.
- [ ] (M3B) attended: a certificate is installed on the test device and
      served after a reboot, if the user chooses to.
