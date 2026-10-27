---
id: REQ-KEY-009
title: Derive a key by ECDH and HKDF
status: verified
priority: must
revision: 5
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
create without the `MLKEM*` and `MLDSA*` types [YAML]. For a `SECP*` target
the library sends `mode: ECDH` when the caller gives no mode.

**Rationale:** For a `type` it does not recognise, the firmware answers 200
and echoes the source key id without creating anything [YAML] — a silent
failure the library has to turn into an error. The derivation cannot be
reproduced outside the device, and repeating it is refused with 406 [C-SDK].
The `mode` default follows key create (REQ-KEY-001): a `SECP*` key without
a usage flag is unusable (user decision 2026-10-27, §6.2 impact analysis at
STEP-M2B-075; revision 5). Introduced in M2.

**Acceptance criteria:**
- [x] The body is `{kid, label, type}` plus one of `ext_kid` or `pubkey`,
      `descr` when given, and `mode` for a `SECP*` target — the caller's,
      else `ECDH` — and never for another type; the scope used is
      `keymgmt:gen` — STEP-M2B-075 (2026-10-27), unit-tested over all 17
      target types.
- [x] Giving both peers, neither, or a target type outside the list raises
      `HemValidationError` before sending — `DERIVABLE_KEY_TYPES` is the
      create list without `MLKEM*`/`MLDSA*`.
- [x] A reply whose key id equals the source key id raises
      `HemProtocolError`.
- [x] (M2B) a key is derived on the test device from two X25519 keys and
      appears in the list — live 2026-10-27 (STEP-M2B-010): type `AES256`,
      listed with its label; deriving the same key again → 406 (quirk 12).
- [x] (M2B) the echo behaviour is probed with an unrecognised type sent
      outside the library's validation, and the result recorded — live
      2026-10-27 (STEP-M2B-010): an arbitrary string (`EHEMTEST-NOT-A-TYPE`)
      is refused with 400; a known type the derive cannot produce
      (`MLKEM768`) is answered 200 with the *source* key id and no key is
      created — the echo of quirk 4, exactly as the reference describes.
      The library's guards (type list before sending, echoed id →
      `HemProtocolError`) cover both.
- [ ] (M2B) a `SECP256R1` key derived without `mode` is listed with the
      `ECDH` flag — **not observable on firmware 1.2.2-DIAG** (2026-10-27,
      STEP-M2B-075): every `SECP*` derive target is refused with 406, with
      no mode, `ECDH` or `ECDH,ExDSA`, from an X25519 or a P-256 source,
      while a `CURVE25519` target from the same source derives and is
      listed `PKEY,ECDH,CURVE25519` (quirk 21;
      tests/integration/keys-secp-mode.test.ts records the refusal). Left
      open for the user: drop the criterion, or carry it to a firmware that
      derives `SECP*` keys.
