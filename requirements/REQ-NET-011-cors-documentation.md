---
id: REQ-NET-011
title: Browser use and the device's origin allow-list documented
status: verified
priority: must
revision: 5
source: start_point §6 Q6; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Browser use and the device's origin allow-list documented

The README SHALL document that browser use requires the calling origin to be
on the device's `origin` allow-list, and that configuring that list is the
caller's responsibility.

**Rationale:** When a request carries an `Origin` header the device checks
it against its allow-list and answers 412 on a mismatch [YAML]. The library
cannot change that list on the caller's behalf in the MVP, so it has to say
clearly who does. This is the proposed answer to open question Q6.
Introduced in M1.

**Acceptance criteria:**
- [x] The README has a section on browser use covering: what 412 means,
      where the allow-list is set (at provisioning and through configuration
      write), and its match syntax (`*`, an exact origin, `*.domain.tld`)
      [YAML].
- [x] It names the error class raised for 412 (REQ-API-002).
- [ ] (M3B) attended: a call from a browser page is made with an allowed and
      with a disallowed origin; the outcomes and the device's current
      allow-list are recorded. 2026-10-12: the allow-list is `*` (any
      origin); allowed origins succeed (REQ-NET-009). A disallowed origin
      cannot occur under `*`, and changing the list is a configuration write,
      which REQ-TEST-005 does not permit in M1B. **Disallowed-origin case
      carried to M3B** (user decision 2026-10-12), where configuration write
      arrives and the allow-list can be narrowed for the test. Also found:
      Chromium blocks every request from another origin to the device's local
      address until the user allows local network access (documented in the
      README).
