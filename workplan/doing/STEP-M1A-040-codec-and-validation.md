---
id: STEP-M1A-040
title: Codec and input validators
milestone: M1A
implements: ["REQ-API-004", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1A-030"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `src/codec/` converts bytes to and from standard base64,
base64url, lowercase hex and UTF-8 with no Node-only API, and exports
validators for the reference's hard limits that raise `HemValidationError`
naming the offending parameter.

**Notes:** Encode to standard base64 with padding; decode both alphabets,
padded or not. Validators: key id exactly 32 hex characters, normalised to
lower case; label 1 to 32 printable ASCII characters; description at most
64 bytes; message 1 to 2048 bytes; serialised JSON body at most 7300 bytes.
The body check is applied by the transport (STEP-M1A-050), the others by
the bindings (STEP-M1A-140, STEP-M1A-150). `TextEncoder`, `TextDecoder`,
`atob` and `btoa` exist in both runtimes; a hand-written base64 is
acceptable where it is simpler to make byte-exact.

**Definition of done**
- [ ] Round-trip tests cover standard base64 with padding, base64url without padding and lowercase hex, including the empty input and all 256 byte values
- [ ] Decoding accepts the standard and the URL-safe alphabet, with and without padding
- [ ] No `Buffer` or other Node-only API is used; the codec tests pass in the browser run
- [ ] Each limit violation raises `HemValidationError` naming the parameter
- [ ] Boundary values are accepted: a 32-character label, a 64-byte description, a 2048-byte message, a 7300-byte body
- [ ] An upper-case hex key id is accepted and normalised to lower case; an empty message is rejected where the reference requires one
