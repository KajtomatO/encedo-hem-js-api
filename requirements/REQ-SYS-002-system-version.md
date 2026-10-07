---
id: REQ-SYS-002
title: Hardware and firmware version
status: verified
priority: must
revision: 4
source: start_point §3; start_point G19; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-006", "REQ-API-004"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Hardware and firmware version

The library SHALL provide a call for `GET /api/system/version` that returns
the device's hardware and firmware identity.

**Rationale:** A caller checks compatibility by comparing the firmware
version with the API version the library targets (REQ-API-010). The hardware
version also tells which hardware build it is talking to. Introduced in M1.

**Acceptance criteria:**
- [x] No `Authorization` header is sent.
- [x] The result contains `hwv` and `fwv` as strings and `fwk` and `fws` as
      bytes; `blv`, `blk`, `bls`, `sd_csd`, `sd_cid` and `uis` are included
      when the device sends them.
- [x] (M1B) the live values of the test device are recorded — 2026-10-07:
      `hwv` "PPA rev 2.2", `fwv` "Encedo nGINE FW v1.2.2-DIAG", `fwk` 32
      bytes, `fws` 64 bytes, `blv` "Encedo Secure Bootloader v2.0.1", `blk`
      32 bytes, `bls` 64 bytes, `uis` 32 bytes; no `sd_csd`/`sd_cid`.
