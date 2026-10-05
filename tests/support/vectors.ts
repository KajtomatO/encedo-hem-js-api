// Login vector of REQ-AUTH-002 (from https://github.com/KajtomatO/encedo-hem-c-api,
// recomputed independently on 2026-10-02). Shared by the eJWT and login tests.
// supports: REQ-AUTH-002, REQ-AUTH-003
export const loginVector = {
  passphrase: 'correct horse battery staple',
  eid: 'd4ad81b06b1d493ab2b6f9b1a3e2c7f0',
  spk: 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=',
  jti: '0123456789abcdef',
  scope: 'keymgmt:gen',
  iat: 1700000000,
  exp: 1700003600,
  iss: 'CdLq53eX780FeZR4/hOee5rTtcl7ajJdYwVwcjL5cxY=',
  header: 'eyJlY2RoIjoieDI1NTE5IiwiYWxnIjoiSFMyNTYiLCJ0eXAiOiJKV1QifQ',
  claims:
    'eyJqdGkiOiIwMTIzNDU2Nzg5YWJjZGVmIiwiYXVkIjoiQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRUJBUUVCQVFFQkFRRT0iLCJleHAiOjE3MDAwMDM2MDAsImlhdCI6MTcwMDAwMDAwMCwiaXNzIjoiQ2RMcTUzZVg3ODBGZVpSNC9oT2VlNXJUdGNsN2FqSmRZd1Z3Y2pMNWN4WT0iLCJzY29wZSI6ImtleW1nbXQ6Z2VuIn0',
  tag: 'oPm7pWzqB9VImg5OpTllCqbQAO-xkdgoRfdzyLj09qE',
} as const;
