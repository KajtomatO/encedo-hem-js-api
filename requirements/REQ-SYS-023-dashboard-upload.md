---
id: REQ-SYS-023
title: Dashboard archive upload
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-017", "REQ-API-011", "REQ-NET-009"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#7-transport"]
---

# Dashboard archive upload

The library SHALL provide a call for `POST /api/system/upgrade/upload_ui`
that uploads a dashboard archive given as bytes, a `Blob` or a stream.

**Rationale:** The dashboard is replaced by uploading a `webroot.tar`
archive; the same upload mechanics as for firmware apply [YAML]. Introduced
in M3.

**Acceptance criteria:**
- [ ] The body is the raw archive with `Content-Type:
      application/octet-stream` and `Content-Disposition` naming
      `webroot.tar`; the scope used is `system:upgrade`.
- [ ] An archive larger than the device's 16 MiB upload limit raises
      `HemValidationError` before sending.
- [ ] The documentation states that the operation needs mass-storage
      hardware.
- [ ] (M3B) attended: an archive is uploaded only if the user provides one
      and decides to.
