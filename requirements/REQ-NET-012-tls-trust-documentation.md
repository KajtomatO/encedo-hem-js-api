---
id: REQ-NET-012
title: Custom TLS trust through the caller's fetch documented
status: draft
priority: must
revision: 1
source: start_point §6 Q4; start_point G6; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-NET-001"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Custom TLS trust through the caller's fetch documented

The README SHALL document how a caller supplies a `fetch` with custom TLS
trust for a device certificate that the runtime does not trust by default.

**Rationale:** The dev device presents a public-CA certificate for
`my.ence.do` [C-SDK], so default trust works only while that certificate is
valid and the device is addressed by that name. An IP address, an expired
certificate or a private one all need custom trust, and the library
deliberately has no TLS setting of its own. Introduced in M1.

**Acceptance criteria:**
- [ ] The README shows a working Node 24 method for trusting a certificate
      the runtime rejects, and one for connecting by IP address.
- [ ] It states that browsers offer no such override.
- [ ] It states that the library has no TLS option and does not recover
      automatically from an expired device certificate.
- [ ] (M1B) the documented method is used against the device, and the
      certificate's issuer, subject and validity are recorded.
