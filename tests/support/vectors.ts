// supports: REQ-AUTH-002, REQ-AUTH-003
// Published test vectors and the login vector of REQ-AUTH-002.

/** The REQ-AUTH-002 login vector (from [C-SDK], recomputed 2026-10-02). */
export const LOGIN_VECTOR = {
  passphrase: "correct horse battery staple",
  eid: "d4ad81b06b1d493ab2b6f9b1a3e2c7f0",
  spk: "AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=",
  jti: "0123456789abcdef",
  scope: "keymgmt:gen",
  iat: 1700000000,
  exp: 1700003600,
  iss: "CdLq53eX780FeZR4/hOee5rTtcl7ajJdYwVwcjL5cxY=",
  header: "eyJlY2RoIjoieDI1NTE5IiwiYWxnIjoiSFMyNTYiLCJ0eXAiOiJKV1QifQ",
  claims:
    "eyJqdGkiOiIwMTIzNDU2Nzg5YWJjZGVmIiwiYXVkIjoiQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRT0iLCJleHAiOjE3MDAwMDM2MDAsImlhdCI6MTcwMDAwMDAwMCwiaXNzIjoiQ2RMcTUzZVg3ODBGZVpSNC9oT2VlNXJUdGNsN2FqSmRZd1Z3Y2pMNWN4WT0iLCJzY29wZSI6ImtleW1nbXQ6Z2VuIn0",
  tag: "oPm7pWzqB9VImg5OpTllCqbQAO-xkdgoRfdzyLj09qE",
} as const;

export const LOGIN_VECTOR_PROOF = `${LOGIN_VECTOR.header}.${LOGIN_VECTOR.claims}.${LOGIN_VECTOR.tag}`;

/** RFC 7914 §11: PBKDF2-HMAC-SHA256("passwd", "salt", 1, 64). */
export const PBKDF2_SHA256_VECTOR = {
  password: "passwd",
  salt: "salt",
  iterations: 1,
  dk: "55ac046e56e3089fec1691c22544b605f94185216dde0465e68b9d57c20dacbc49ca9cccf179b645991664b39d77ef317c71b845b1e30bd509112041d3a19783",
} as const;

/** RFC 7748 §5.2 test 1 and §6.1 Diffie-Hellman. */
export const X25519_VECTORS = {
  scalarMult: {
    scalar: "a546e36bf0527c9d3b16154b82465edd62144c0ac1fc5a18506a2244ba449ac4",
    u: "e6db6867583030db3594c1a424b15f7c726624ec26b3353b10a903a6d0ab1c4c",
    out: "c3da55379de9c6908e94ea4df28d084f32eccf03491c71f754b4075577a28552",
  },
  dh: {
    alicePriv: "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
    alicePub: "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a",
    bobPriv: "5dab087e624a8a4b79e17f8b83800ee66f3bb1292618b6fd1c2f8b27ff88e0eb",
    bobPub: "de9edb7d7b7dc1b4d35b61c2ece435373f8343c85b78674dadfc7e146f882b4f",
    shared: "4a5d9d5ba4ce2de1728e3bf480350f25e07e21c947d19e3376f09b3c1e161742",
  },
} as const;
