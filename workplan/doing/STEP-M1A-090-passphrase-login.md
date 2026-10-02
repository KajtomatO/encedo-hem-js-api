---
id: STEP-M1A-090
title: Passphrase login and credential lifecycle
milestone: M1A
implements: ["REQ-AUTH-001", "REQ-AUTH-006", "REQ-AUTH-011", "REQ-API-009"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#6-protocol-bindings"]
depends_on: ["STEP-M1A-070", "STEP-M1A-080"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `src/api/auth.ts` binds `GET` and `POST /api/auth/token`, and the
session engine's login primitive obtains a token unattended from a
passphrase: challenge, derive, agree, prove, submit. The credential is
derived once, bound to the challenge `eid`, held as a non-extractable
`CryptoKey`, and discarded together with every token on `logout()`.

**Notes:** Neither request carries `Authorization`. Lifetime defaults to
28 800 s, is configurable and validated; `exp = iat + lifetime`,
independent of the challenge `exp`. A challenge whose `eid` differs from
the one the key was derived for raises `HemUnauthenticatedError` stating
that the device identity changed. Errors of a failed login must not contain
the passphrase, the eJWT or a token in message, properties or JSON form.
Clock recovery (REQ-AUTH-009) hooks in at STEP-M1A-130; here 403 and 401
are reported as mapped. Role exposure (REQ-AUTH-010) is in STEP-M1A-100.

**Definition of done**
- [ ] With a replayed challenge the requests are one GET then one POST, neither with `Authorization`, and the POST body is `{"auth": <proof>}` with the exact REQ-AUTH-002 proof for the vector inputs
- [ ] A challenge missing `eid`, `spk` or `jti`, an `spk` not decoding to 32 bytes, or a reply without `token` raises `HemProtocolError`
- [ ] A 401 on the proof raises `HemUnauthenticatedError`; a 409 raises `HemDeviceStateError`
- [ ] By default `exp − iat` is 28 800; a configured lifetime is used; a challenge `exp` 60 s ahead does not shorten it; a zero, negative or non-integer lifetime raises `HemValidationError`
- [ ] After `logout()` the credential and every cached token are gone and a login attempt raises `HemUnauthenticatedError` without any request
- [ ] The passphrase is not retained after derivation; the key is bound to its `eid`; a different `eid` raises `HemUnauthenticatedError` naming the identity change; the key is a non-extractable `CryptoKey` where the runtime allows
- [ ] The error of a failed login, in message, properties and JSON form, contains neither the passphrase, the eJWT nor a token
