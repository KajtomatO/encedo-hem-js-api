---
id: REQ-SYS-008
title: Read device configuration
status: draft
priority: must
revision: 1
source: start_point §4; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-005", "REQ-API-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Read device configuration

The library SHALL provide a call for `GET /api/system/config` that returns
the device configuration and identity keys.

**Rationale:** Day-to-day use needs the configuration read-only: who the
device belongs to, its identity keys, its origin allow-list and its option
flags. Introduced in M2.

**Acceptance criteria:**
- [ ] The scope used is `system:config`.
- [ ] The result exposes the fields the reference marks as required — among
      them `devid`, `eid`, `eid_sign`, `user`, `email`, `hostname`,
      `origin`, `trusted_ts`, `trusted_backend`, `allow_keysearch`, `ip`,
      `spk`, `nonce` — with key material as bytes.
- [ ] Optional fields (`instanceid` and the mass-storage ones) are included
      when present.
- [ ] (M2B) the live configuration of the test device is read; field
      presence is recorded.
