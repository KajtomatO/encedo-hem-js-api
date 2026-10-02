---
id: REQ-AUTH-003
title: PBKDF2 as the only login key derivation
status: approved
priority: must
revision: 1
source: user decision 2026-10-02; start_point §6 Q1; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login", "ARCHITECTURE.md#1-decisions-fixed"]
---

# PBKDF2 as the only login key derivation

The login private key SHALL be derived from the passphrase with
PBKDF2-HMAC-SHA256 using 600 000 iterations, a 32-byte output, and the
challenge `eid` string, unmodified, as the salt.

**Rationale:** The device stores only the public key that was registered
when it was initialised, so login works only if the client re-derives the
same private key. These are the parameters that authenticate against the dev
device [C-SDK]. Descriptions of an Argon2 derivation in [DOC] and in older
[C-SDK] text are incorrect and are ignored (user decision 2026-10-02); no
other derivation is offered. Introduced in M1.

**Acceptance criteria:**
- [ ] The PBKDF2 wrapper reproduces a published PBKDF2-HMAC-SHA256 test
      vector.
- [ ] The passphrase is used as its UTF-8 bytes, without normalisation.
- [ ] The salt is the UTF-8 bytes of the `eid` text as received, not its
      base64-decoded bytes.
- [ ] The 32-byte output is used as the X25519 private key; for the vector
      of REQ-AUTH-002 the derived public key equals the stated `iss`.
- [ ] The X25519 wrapper reproduces the RFC 7748 test vectors in Node 24 and
      in the browser run (ARCHITECTURE.md §11, risk 1).
- [ ] The public API offers no way to select another derivation.
