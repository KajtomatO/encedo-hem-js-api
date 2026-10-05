---
id: STEP-M1A-120
title: Passphrase login and credential handling
milestone: M1A
implements: ["REQ-AUTH-001", "REQ-AUTH-006", "REQ-AUTH-011", "REQ-API-009", "REQ-AUTH-003"]
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#52-session-behaviour"]
depends_on: ["STEP-M1A-060", "STEP-M1A-100"]
evidence:
  commits: ["6cbf58e"]
  tests: ["verifies: REQ-AUTH-001 (tests/unit/login.test.ts)", "verifies: REQ-AUTH-006 (tests/unit/login.test.ts)", "verifies: REQ-AUTH-011 (tests/unit/login.test.ts)", "verifies: REQ-API-009 (tests/unit/login.test.ts)", "verifies: REQ-AUTH-003 (tests/unit/login.test.ts)", "supports: REQ-AUTH-001 (tests/support/login.ts)"]
  notes: "npm run check: 35 files, 598 tests passed in Node v24.21.0 and headless Chromium. The login is replayed against the REQ-AUTH-002 vector through the real flow (pinned clock, lifetime 3600) and posts the vector proof byte for byte. Operations flagged sensitive (auth.login) raise errors without response body or cause (a JSON parse error quotes its input). The passphrase reference is dropped once the key is derived; a later challenge with another eid fails as a changed device identity. Client options added: passphrase, tokenLifetimeSeconds, now (clock, for tests). Token caching is not part of this step: the client logs in for every authenticated call until STEP-M1A-130."
reopened: []
cancelled: null
---

**Goal:** Given a passphrase and a scope, the session engine obtains a bearer
token from the device on its own — challenge, key derivation, key agreement,
proof, submission — and treats the credential as REQ-AUTH-011 requires.

**Notes:**
- `src/api/auth.ts` gets the two device calls (`GET` and `POST
  /api/auth/token`); the engine goes in `src/auth/`. The flow and its
  encodings are in ARCHITECTURE.md §5.1 and REQ-AUTH-001/002, all from
  [C-SDK].
- Lifetime (REQ-AUTH-006): the proof's `exp` is local time plus the
  lifetime — 28 800 seconds by default, configurable — and is not limited by
  the challenge's own `exp`. Local time comes from an injectable clock so a
  test can pin `iat` and replay the REQ-AUTH-002 vector exactly.
- Credential (REQ-AUTH-011): the salt is the challenge `eid`, so the
  passphrase has to be held until the first challenge arrives. After the
  derivation it is dropped; the non-extractable private key and the public
  key stay bound to that `eid`. A later challenge with another `eid` cannot
  be answered and is reported as a changed device identity.
- The credential option has no selector for another derivation
  (REQ-AUTH-003, ARCHITECTURE.md D6).
- Neither login request carries an `Authorization` header.
- This step delivers token acquisition only. Caching, attaching and renewal
  are STEP-M1A-130, the 401 retry is STEP-M1A-140, clock recovery is
  STEP-M1A-150.
- Master login has not been exercised by any §8 source (ARCHITECTURE.md §11
  risk 9); nothing in this step is specific to a role.
- Partly closed here: REQ-AUTH-003 (no other derivation selectable),
  REQ-API-009 (failed-login error). Closed elsewhere: REQ-AUTH-011 "after
  logout" and REQ-API-009 "failed authenticated call" in STEP-M1A-130;
  REQ-API-009 static check in STEP-M1A-030.

**Definition of done**
- [x] With a substituted `fetch` replaying the REQ-AUTH-002 challenge and a
      pinned clock, the requests are one GET then one POST, neither carries
      an `Authorization` header, and the POST body is exactly the expected
      proof.
- [x] A challenge missing `eid`, `spk` or `jti`, an `spk` that does not
      decode to 32 bytes, or a reply without `token`, raises
      `HemProtocolError`.
- [x] A 401 on the proof raises `HemUnauthenticatedError`; a 409 raises
      `HemDeviceStateError`.
- [x] By default `exp − iat` in the proof is 28 800; a configured lifetime is
      used instead; a challenge whose `exp` is 60 seconds ahead does not
      shorten it.
- [x] A lifetime that is zero, negative or not an integer raises
      `HemValidationError`.
- [x] The passphrase is not retained after the private key has been derived;
      the derived key is kept bound to the `eid` it was derived for.
- [x] A challenge carrying a different `eid` raises `HemUnauthenticatedError`
      stating that the device identity changed.
- [x] The private key is held as a non-extractable `CryptoKey` where the
      runtime allows it.
- [x] The public options offer no way to select another key derivation.
- [x] The error of a failed login — message, properties and JSON form —
      contains neither the passphrase, the eJWT nor a token.
- [x] The suite passes in Node 24 and in the browser run.
- [x] `implements:` and `verifies:` tags exist for the REQs above.
- [x] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
