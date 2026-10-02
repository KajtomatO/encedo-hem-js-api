---
id: REQ-KEY-009
title: Derive a key by ECDH and HKDF
status: draft
priority: must
revision: 1
source: start_point §4; start_point G16; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-005", "REQ-API-005"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Derive a key by ECDH and HKDF

The library SHALL provide a call for `POST /api/keymgmt/derive` that derives
a new stored key from a stored private key and a peer public key, and
returns the new key id.

The peer is given either as a stored key id (`ext_kid`) or as raw public-key
bytes (`pubkey`), exactly one of the two. Target types are those of key
create without the `MLKEM*` and `MLDSA*` types [YAML].

**Rationale:** For a `type` it does not recognise, the firmware answers 200
and echoes the source key id without creating anything [YAML] — a silent
failure the library has to turn into an error. The derivation cannot be
reproduced outside the device, and repeating it is refused with 406 [C-SDK].
Introduced in M2.

**Acceptance criteria:**
- [ ] The body is `{kid, label, type}` plus one of `ext_kid` or `pubkey`,
      and `mode` and `descr` when given; the scope used is `keymgmt:gen`.
- [ ] Giving both peers, neither, or a target type outside the list raises
      `HemValidationError` before sending.
- [ ] A reply whose key id equals the source key id raises
      `HemProtocolError`.
- [ ] (M2B) a key is derived on the test device from two X25519 keys and
      appears in the list.
- [ ] (M2B) the echo behaviour is probed with an unrecognised type sent
      outside the library's validation, and the result recorded.
