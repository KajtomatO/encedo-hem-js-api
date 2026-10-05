---
id: STEP-M1A-220
title: README and operation-documentation check
milestone: M1A
implements: ["REQ-API-007", "REQ-NET-011", "REQ-NET-012", "REQ-API-010", "REQ-BUILD-004"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#7-transport"]
depends_on: ["STEP-M1A-110", "STEP-M1A-170", "STEP-M1A-180", "STEP-M1A-210"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** The README tells an integrator what must be known before first use,
and an automated check fails for any public operation whose documentation
lacks its token scope or its milestone.

**Notes:**
- Documentation check (REQ-API-007): it walks every public operation and
  fails when the TSDoc lacks the scope — "none" has to be stated for public
  operations — or the milestone. It also confirms the comments reach the
  emitted `.d.ts` files, so it needs the build output and is a Node-only
  test.
- README content, each part owned by a REQ:
  - runtime requirements — Node.js 24 or later, browsers with Web Crypto
    X25519 (REQ-BUILD-004);
  - comparing the exported API version with the firmware version read from
    the device (REQ-API-010);
  - browser use and the device's origin allow-list (REQ-NET-011): what 412
    means, where the list is set, its match syntax, all from [YAML], and
    the error class raised;
  - custom TLS trust through the caller's `fetch` (REQ-NET-012).
- The two Node 24 methods of REQ-NET-012 — a certificate the runtime
  rejects, and connecting by IP address — are checked against the Node.js
  documentation and tried against a local self-signed HTTPS server before
  they are written down. The trial is recorded as evidence; it is not part
  of the unit suite, which has no network. Using them against the device is
  the REQ's `(M1B)` criterion.
- `implements:` tags for the README REQs are HTML comments in `README.md`
  (REQUIREMENTS-MANAGEMENT.md §4.2, as amended 2026-10-05); their
  `verifies:` tests check that the sections exist and are Node-only.
- The README references nothing outside this repo except whole repositories
  by URL (CLAUDE.md).
- Partly closed here: REQ-API-010 and REQ-BUILD-004 (their README criteria).

**Definition of done**
- [ ] An automated check fails for any public operation whose documentation
      lacks the scope or the milestone; operations that need no token state
      the scope as none.
- [ ] The documentation comments are present in the emitted type
      declarations.
- [ ] README: the Node.js requirement and the browser requirement (Web Crypto
      with X25519).
- [ ] README: how to compare the exported API version with the firmware
      version read from the device.
- [ ] README, browser use: what 412 means, where the allow-list is set (at
      provisioning and through configuration write), its match syntax (`*`,
      an exact origin, `*.domain.tld`), and the error class raised for 412.
- [ ] README, TLS trust: a working Node 24 method for trusting a certificate
      the runtime rejects and one for connecting by IP address, both tried
      against a local self-signed server with the result noted in the
      evidence.
- [ ] README, TLS trust: states that browsers offer no such override, that
      the library has no TLS option, and that it does not recover
      automatically from an expired device certificate.
- [ ] Tests check that the README sections exist.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
