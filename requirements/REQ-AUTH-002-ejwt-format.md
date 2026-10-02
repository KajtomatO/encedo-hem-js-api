---
id: REQ-AUTH-002
title: Login proof encoding (eJWT)
status: draft
priority: must
revision: 1
source: start_point §6 Q1; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-003"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#51-passphrase-login"]
---

# Login proof encoding (eJWT)

The login proof SHALL be encoded as three dot-separated base64url segments
without padding — fixed header, claims, HMAC-SHA256 tag — such that the
reference vector below is reproduced byte for byte.

- Header: the fixed byte string
  `{"ecdh":"x25519","alg":"HS256","typ":"JWT"}`.
- Claims: compact JSON with no whitespace, keys in the order `jti`
  (from the challenge), `aud` (the challenge `spk` string, verbatim),
  `exp`, `iat` (integers, Unix seconds), `iss` (the user's X25519 public
  key, standard base64 with padding), `scope`.
- Tag: HMAC-SHA256 keyed with the raw 32-byte shared secret, over the
  ASCII text `<header segment>.<claims segment>`.

Reference vector (from [C-SDK]; recomputed independently on 2026-10-02 with
a separate implementation, with an identical result):

| Input | Value |
|---|---|
| passphrase | `correct horse battery staple` |
| challenge `eid` | `d4ad81b06b1d493ab2b6f9b1a3e2c7f0` |
| challenge `spk` | `AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=` |
| challenge `jti` | `0123456789abcdef` |
| scope | `keymgmt:gen` |
| `iat` | `1700000000` |
| `exp` | `1700003600` |

| Output | Value |
|---|---|
| `iss` | `CdLq53eX780FeZR4/hOee5rTtcl7ajJdYwVwcjL5cxY=` |
| header segment | `eyJlY2RoIjoieDI1NTE5IiwiYWxnIjoiSFMyNTYiLCJ0eXAiOiJKV1QifQ` |
| claims segment | `eyJqdGkiOiIwMTIzNDU2Nzg5YWJjZGVmIiwiYXVkIjoiQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRT0iLCJleHAiOjE3MDAwMDM2MDAsImlhdCI6MTcwMDAwMDAwMCwiaXNzIjoiQ2RMcTUzZVg3ODBGZVpSNC9oT2VlNXJUdGNsN2FqSmRZd1Z3Y2pMNWN4WT0iLCJzY29wZSI6ImtleW1nbXQ6Z2VuIn0` |
| tag segment | `oPm7pWzqB9VImg5OpTllCqbQAO-xkdgoRfdzyLj09qE` |

**Rationale:** The device verifies the tag over the exact bytes it receives,
so the encoding has to be pinned to a vector rather than described loosely.
The firmware reads only the `ecdh` header field [C-SDK]; the full header is
kept so the vector stays shared with the C client. Introduced in M1.

**Acceptance criteria:**
- [ ] A unit test feeds the vector inputs through the real derivation
      (600 000 PBKDF2 iterations included) and obtains the three output
      segments exactly.
- [ ] The claims are serialised without whitespace, in the stated order,
      with `/` not escaped.
- [ ] The vector test passes in Node 24 and in the browser run.
