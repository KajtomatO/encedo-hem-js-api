---
id: STEP-M1A-050
title: Codec and input validation
milestone: M1A
implements: ["REQ-API-004", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#2-context--constraints"]
depends_on: ["STEP-M1A-040"]
evidence:
  commits: ["1bb426a"]
  tests: ["verifies: REQ-API-004 (tests/unit/codec.test.ts)", "verifies: REQ-API-005 (tests/unit/validate.test.ts)"]
  notes: "npm run check: 19 files, 248 tests passed in Node v24.21.0 and headless Chromium. REQ-API-005 criteria left open: 'zero fetch calls' closes with the binding core (STEP-M1A-100); 'upper-case key id sent in lower case' is ticked when a binding sends a key id (STEP-M1A-160) — the validator's normalisation is tested here."
reopened: []
cancelled: null
---

**Goal:** Bytes convert to and from base64, base64url, hex and UTF-8
identically in Node and in browsers, and every documented input limit has a
validator that raises `HemValidationError` naming the parameter.

**Notes:**
- `src/codec/`. No `Buffer` or other Node-only API (REQ-BUILD-003); the
  browser run is the check.
- Towards the device, binary values are standard base64 with padding. From
  the device, both the standard and the URL-safe alphabet are accepted, with
  or without padding (REQ-API-004).
- Limits, from [YAML] as listed in REQ-API-005: key id exactly 32 hexadecimal
  characters; label 1 to 32 printable ASCII characters; description at most
  64 bytes; message at most 2048 bytes, and not empty where the operation
  requires one; serialised JSON body at most 7300 bytes.
- The codec never truncates or alters caller data (ARCHITECTURE.md §3). The
  one stated normalisation is the key id: upper-case hex is accepted and sent
  in lower case.
- Depends on STEP-M1A-040 for `HemValidationError`.
- Closed elsewhere: the body-size validator is applied by the binding core
  (STEP-M1A-100, REQ-API-005 listed there); "no public operation takes or
  returns base64 text" is checked on the finished surface (STEP-M1A-230,
  REQ-API-004 listed there).

**Definition of done**
- [x] Round-trip tests cover standard base64 with padding, base64url without
      padding and lowercase hex, including the empty input and all 256 byte
      values.
- [x] Decoding accepts the standard and the URL-safe alphabet, with and
      without padding.
- [x] UTF-8 helpers exist for the conversions later steps need.
- [x] Each validator raises `HemValidationError` naming the offending
      parameter: key id, label, description, message, body size.
- [x] Boundary values are accepted — a 32-character label, a 64-byte
      description, a 2048-byte message, a 7300-byte body — and one past each
      is rejected.
- [x] A key id in upper-case hex is accepted and normalised to lower case.
- [x] An empty message is rejected by the validator used for operations that
      require one.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
