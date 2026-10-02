---
id: REQ-AUTH-022
title: Device provisioning
status: approved
priority: must
revision: 1
source: start_point §5; start_point M3.2; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-api-doc
depends_on: ["REQ-AUTH-021", "REQ-AUTH-003", "REQ-API-012"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#5-auth--session", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Device provisioning

The library SHALL provide a dedicated call that provisions a factory-fresh
device through `POST /api/auth/init`.

The caller gives the user passphrase, the master passphrase and the
configuration values. The library derives both key pairs with the derivation
of REQ-AUTH-003 (salt = the challenge `eid`), places the two public keys in
the configuration as `userkey` and `masterkey`, and sends `{"init": "<signed
JWT>"}`.

Required configuration [YAML]: `user`, `masterkey`, `userkey`, `hostname`,
`origin`, `trusted_ts`, `trusted_backend`, `allow_keysearch`, `email`; on
mass-storage hardware also `ip`, `storage_mode`, `storage_disk0size`,
`dnsd`. Optional: `ctx`, `gen_csr`.

**Rationale:** Taking a factory-fresh device to a working state is part of
the M3 goal. Provisioning is one-shot and decides which passphrases will
ever work, so it is its own call (REQ-API-012). The JWT is described by
[YAML] only as carrying `jti` and `cfg`; [DOC] adds that it is signed like
the login proof with the master key and carries `aud`, `exp`, `iat` and
`iss`. No §8 source has verified this against a device. Introduced in M3.

**Acceptance criteria:**
- [ ] Missing required configuration raises `HemValidationError` before any
      request.
- [ ] The result contains `instanceid` and `token`, plus `reboot_required`,
      `csr` and `genuine` when present.
- [ ] The returned token is cached under `system:config`.
- [ ] A 406 (already initialised) raises `HemOperationFailedError`; the call
      is never repeated automatically.
- [ ] (M3B) attended and destructive, only if the user chooses to: the claim
      layout and the signing key of the init JWT are confirmed against a
      device, and a login with the user passphrase works afterwards.
