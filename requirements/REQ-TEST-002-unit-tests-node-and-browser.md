---
id: REQ-TEST-002
title: Unit tests pass in Node.js and in a browser
status: approved
priority: must
revision: 1
source: start_point G3; ARCHITECTURE.md §1
depends_on: ["REQ-TEST-001"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy"]
---

# Unit tests pass in Node.js and in a browser

The unit test suite SHALL pass both in Node.js 24 and in a headless browser.

**Rationale:** The package promises to run in both. Web Crypto differs
between runtimes in exactly the area this library depends on (X25519 key
import), so the promise has to be tested, not assumed. Introduced in M1.

**Acceptance criteria:**
- [ ] One command runs the same test files in Node 24 and in a headless
      browser.
- [ ] The browser run includes the cryptographic tests: PBKDF2, X25519,
      HMAC-SHA256 and the eJWT vector.
- [ ] The CI workflow runs both (REQ-BUILD-005).
