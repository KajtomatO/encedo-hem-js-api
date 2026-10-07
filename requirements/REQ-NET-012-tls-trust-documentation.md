---
id: REQ-NET-012
title: Custom TLS trust through the caller's fetch documented
status: needs-reverify
priority: must
revision: 6
source: start_point §6 Q4; start_point G6; https://github.com/KajtomatO/encedo-hem-c-api; user decision 2026-10-07 (methods built on REQ-NET-013)
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
deliberately has no TLS setting of its own. Amended 2026-10-07: the Node
methods are built on the library's own Node.js transport
(`createNodeFetch`, REQ-NET-013), because Node's `fetch` cannot drive
firmware 1.2.2 (ARCHITECTURE.md §6 quirk 18); they are still passed as
`fetch`. Introduced in M1.

**Acceptance criteria:**
- [x] The README shows a working Node 24 method for trusting a certificate
      the runtime rejects, and one for connecting by IP address — both
      through `createNodeFetch`, passed as `fetch` (each exercised against
      a local HTTPS server with a self-signed certificate in the unit suite).
- [x] It states that browsers offer no such override.
- [x] It states that the library has no TLS option and does not recover
      automatically from an expired device certificate.
- [x] (M1B) the documented method is used against the device, and the
      certificate's issuer, subject and validity are recorded — 2026-10-07:
      both README methods reached the device. Certificate: subject
      `CN=my.ence.do`; issuer `ZeroSSL ECC DV SSL CA 2` (ZeroSSL GmbH, AT);
      valid 2026-10-07 00:00:00 to 2027-01-05 23:59:59 GMT; chain through
      `Sectigo Public Server Authentication Root E46` to `USERTrust ECC
      Certification Authority`. Default (system) trust works.
