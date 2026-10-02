---
id: REQ-AUTH-001
title: Unattended passphrase login
status: approved
priority: must
revision: 1
source: start_point M1.1; start_point G9; start_point §6 Q1; https://github.com/KajtomatO/encedo-hem-c-api; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-AUTH-002", "REQ-AUTH-003", "REQ-API-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login"]
---

# Unattended passphrase login

Given a passphrase and a scope, the library SHALL obtain a bearer token from
the device without further caller involvement, by performing the challenge
request, key derivation, key agreement, proof construction and proof
submission itself.

The steps, as proven against firmware 1.2.2 by [C-SDK]:

1. `GET /api/auth/token` returns the challenge `{eid, spk, jti, exp, lbl}`.
2. The private key is derived from the passphrase (REQ-AUTH-003).
3. Shared secret = X25519(private key, `spk`), where `spk` is standard
   base64 of exactly 32 bytes.
4. The proof is built from the challenge and the scope (REQ-AUTH-002).
5. `POST /api/auth/token` with body `{"auth": "<proof>"}` returns
   `{token}`.

**Rationale:** The first consumer is a headless server; nobody is there to
complete a login. The reference does not describe how the proof is built
[YAML]; the flow above is the answer to open question Q1. Introduced in M1.

**Acceptance criteria:**
- [ ] With a substituted `fetch` replaying a challenge, the requests are one
      GET then one POST, neither carries an `Authorization` header, and the
      POST body is exactly the expected proof for the vector of
      REQ-AUTH-002.
- [ ] A challenge missing `eid`, `spk` or `jti`, an `spk` that does not
      decode to 32 bytes, or a reply without `token`, raises
      `HemProtocolError`.
- [ ] A 401 on the proof raises `HemUnauthenticatedError` (after the
      recovery of REQ-AUTH-009 where it applies); a 409 raises
      `HemDeviceStateError`.
- [ ] (M1B) an unattended login against the device succeeds; the token's
      `sub` is `U` and its `scope` equals the requested scope.
- [ ] (M1B) a wrong passphrase raises `HemUnauthenticatedError`; the
      observed response delay is recorded.
