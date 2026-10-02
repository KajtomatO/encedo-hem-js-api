---
id: REQ-SYS-020
title: Firmware image upload
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

# Firmware image upload

The library SHALL provide a call for `POST /api/system/upgrade/upload_fw`
that uploads a firmware image given as bytes, a `Blob` or a stream.

**Rationale:** Firmware images are megabytes of binary; requiring them as
one in-memory JSON value would add limits the platform does not have. The
device takes the raw image with a `Content-Disposition` header naming it
`firmware.bin` or `firmware.hex` [YAML]. Introduced in M3.

**Acceptance criteria:**
- [ ] The body is the raw image with `Content-Type:
      application/octet-stream` and the required `Content-Disposition`
      header; the scope used is `system:upgrade`.
- [ ] An image larger than 3 MiB, or a file name other than the two allowed,
      raises `HemValidationError` before sending, because the device closes
      the connection without answering in those cases [YAML].
- [ ] A stream body is sent without being buffered where the runtime
      supports it; where it does not, the documentation says so.
- [ ] The documentation states that the operation needs mass-storage
      hardware.
- [ ] (M3B) attended: an image is uploaded only if the user provides one and
      decides to.
