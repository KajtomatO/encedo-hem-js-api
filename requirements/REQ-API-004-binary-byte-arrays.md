---
id: REQ-API-004
title: Binary values exchanged as byte arrays
status: verified
priority: must
revision: 1
source: start_point G18; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
---

# Binary values exchanged as byte arrays

Public operations SHALL accept and return binary values as `Uint8Array`,
performing all base64, base64url and hexadecimal conversion internally.

**Rationale:** The device speaks base64 for payloads and hex for key ids
[YAML]. Leaving the conversion to callers invites alphabet and padding
mistakes, and `Uint8Array` is the one binary type both Node and browsers
share. Introduced in M1.

**Acceptance criteria:**
- [ ] Codec round-trip unit tests cover standard base64 with padding,
      base64url without padding and lowercase hex, including the empty input
      and all 256 byte values.
- [ ] Binary values are sent to the device as standard base64 with padding.
- [ ] Binary values received from the device are decoded whether they use
      the standard or the URL-safe alphabet, with or without padding.
- [ ] No public operation takes or returns base64 text for a binary value.
      Key ids (hex strings) and opaque tokens (JWT strings) are text by
      nature and are the stated exceptions.
- [ ] The codec uses no `Buffer` or other Node-only API (it passes in the
      browser run of REQ-TEST-002).
