---
id: REQ-API-005
title: Inputs validated against the documented hard limits before sending
status: verified
priority: must
revision: 1
source: start_point G17; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
---

# Inputs validated against the documented hard limits before sending

Before sending a request, the library SHALL reject inputs that violate these
limits of the reference: a key id that is not exactly 32 hexadecimal
characters; a label that is not 1 to 32 printable ASCII characters; a
description longer than 64 bytes; a serialised JSON body longer than 7300
bytes; a message longer than 2048 bytes.

**Rationale:** The device answers an oversized body by closing the
connection, and silently truncates a 65-byte description on read [C-SDK].
Failing early gives the caller a precise error and spares the device a
pointless request. Introduced in M1.

**Acceptance criteria:**
- [ ] Each violation raises `HemValidationError` naming the offending
      parameter, with zero `fetch` calls.
- [ ] Boundary values are accepted: a 32-character label, a 64-byte
      description, a 2048-byte message, a 7300-byte body.
- [ ] A key id given in upper-case hex is accepted and sent in lower case.
- [ ] An empty message is rejected for operations where the reference
      requires one.
- [ ] (M1B) the device accepts a 32-character label and a 64-byte
      description and returns them unchanged.
