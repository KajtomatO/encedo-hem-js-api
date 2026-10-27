---
id: REQ-SYS-008
title: Read device configuration
status: approved
priority: must
revision: 2
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
- [x] The scope used is `system:config` — `system.config()`, STEP-M2A-060
      (2026-10-27).
- [x] The result exposes the fields the reference marks as required — among
      them `devid`, `eid`, `eid_sign`, `user`, `email`, `hostname`,
      `origin`, `trusted_ts`, `trusted_backend`, `allow_keysearch`, `ip`,
      `spk`, `nonce` — with key material as bytes — `DeviceConfig`: all 19
      required fields of the reference (`eid`, `eid_sign`, `spk`, `nonce`
      as bytes; `devid` stays hexadecimal text); a missing one raises
      `HemProtocolError`.
- [x] Optional fields (`instanceid` and the mass-storage ones) are included
      when present — `instanceid`, `genuineId`, `storageMode`,
      `storageDisk0Size`, `storageCapacity`.
- [ ] (M2B) the live configuration of the test device is read; field
      presence is recorded.
