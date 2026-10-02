---
id: REQ-NET-003
title: Key-management and crypto calls refused over plain HTTP
status: approved
priority: must
revision: 1
source: start_point G8; start_point G16; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Key-management and crypto calls refused over plain HTTP

The client SHALL refuse to send a key-management or cryptographic operation
when the device URL does not use `https:`.

**Rationale:** These calls carry key material and data to be protected. The
device itself rejects them over plain HTTP, but inconsistently: key delete
and HMAC answer 409 where the others answer 418 [YAML]. Refusing on the
client side keeps the data off the wire and gives one consistent error.
Introduced in M1.

**Acceptance criteria:**
- [ ] Every key-management and crypto operation called on an `http:` client
      raises `HemTlsRequiredError` with zero `fetch` calls.
- [ ] System and auth operations on an `http:` client are sent.
- [ ] A 418 from the device also raises `HemTlsRequiredError`.
