---
id: STEP-M1A-110
title: System bindings — status, version, health; tolerant response parsing
milestone: M1A
implements: ["REQ-SYS-001", "REQ-SYS-002", "REQ-SYS-003", "REQ-API-006"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-070"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.system.status()`, `version()` and `health()` work against
a fake `fetch`, and the shared response parser accepts unknown fields and
raises `HemProtocolError` naming any missing required field.

**Notes:** Status (quirk 14): required `ctx`, `uptime`, `temp`,
`fls_state`; `inited` appears only when false, so initialised is true
unless it is present and false; clock-set is true exactly when `ts` or
`time` is present; `storage` and `format` are passed through when present.
Version: `hwv`, `fwv` strings; `fwk`, `fws` bytes; `blv`, `blk`, `bls`,
`sd_csd`, `sd_cid`, `uis` when present. Health: exactly one status request;
unreachable or timed out gives `reachable: false` without throwing; a
caller abort still raises `HemAbortError`; the summary flag is true only
when reachable, initialised, `fls_state` is 0 and the clock is set. None of
these carries `Authorization`, so this step needs only the client shell.

**Definition of done**
- [ ] Parser: unknown extra fields are accepted; a missing required field raises `HemProtocolError` naming it; a non-JSON 2xx body raises `HemProtocolError`; an empty 200 is accepted where the success response is documented as empty
- [ ] Status: no `Authorization`; `ctx`, `uptime`, `temp` and `fls_state` required; initialised and clock-set derived as specified; `storage` and `format` passed through when present
- [ ] Version: no `Authorization`; `hwv` and `fwv` as strings, `fwk` and `fws` as bytes; optional fields included when the device sends them
- [ ] Health: exactly one request; unreachable and timeout yield reachable false without throwing; abort raises `HemAbortError`; the four facts and the summary flag map as specified
- [ ] Each operation is documented with scope none and milestone M1
