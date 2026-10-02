---
id: STEP-M1A-180
title: README, cross-binding checks and the M1A gate
milestone: M1A
implements: ["REQ-NET-011", "REQ-NET-012", "REQ-API-005", "REQ-API-007", "REQ-API-009", "REQ-API-010", "REQ-AUTH-005", "REQ-AUTH-012", "REQ-NET-003", "REQ-NET-009", "REQ-TEST-001", "REQ-BUILD-004"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#10-milestones"]
depends_on: ["STEP-M1A-020", "STEP-M1A-140", "STEP-M1A-150", "STEP-M1A-170"]
evidence:
  commits: ["ea10c4b"]
  tests: ["verifies: REQ-NET-011", "verifies: REQ-NET-012", "verifies: REQ-API-005", "verifies: REQ-API-007", "verifies: REQ-API-009", "verifies: REQ-API-010", "verifies: REQ-AUTH-005", "verifies: REQ-AUTH-012", "verifies: REQ-NET-003", "verifies: REQ-NET-009", "verifies: REQ-TEST-001", "verifies: REQ-BUILD-004", "verifies: REQ-BUILD-005"]
  notes: "npm run check: 607 passed in Node 24 and headless Chromium. A gate: the same run also passed with networking disabled (unshare -rn, loopback only): 38 files, 607 tests. Every M1A REQ (64) carries implements: and verifies: tags; TRACE.md regenerated (README.md and the build/CI files are scanned for implements: tags of the documentation and build REQs). Cross-binding table test over all 25 namespace operations (scope per ARCHITECTURE.md §6, no Authorization on public calls, HTTPS guard with zero fetch calls, header allow-list, every limit with its boundary, no token in errors). Found and fixed here: an oversized body was refused only after a login; Transport.preflight now runs before any token is obtained. The README TLS recipes (NODE_EXTRA_CA_CERTS, undici Agent with ca, checkServerIdentity for IP access) are unverified until M1B. The CI workflow has not yet run on GitHub."
reopened: []
cancelled: null
---

**Goal:** The README covers installation, the Node 24 and browser
requirements, firmware-version comparison, browser use with the origin
allow-list, and custom TLS trust through `fetch`; table-driven tests cover
every M1 operation for the cross-cutting rules; the A gate passes.

**Notes:** README sections: Node 24 or later and Web Crypto with X25519 for
browsers (REQ-BUILD-004); comparing `HEM_API_VERSION` with the firmware
version from the version operation (REQ-API-010); browser use: what 412
means, where the allow-list is set (at provisioning and through
configuration write), the match syntax `*`, exact origin, `*.domain.tld`,
and `HemOriginRejectedError` (REQ-NET-011); TLS trust: a working Node 24
method for a certificate the runtime rejects, one for connecting by IP
address, that browsers offer no override, that the library has no TLS
option and does not recover from an expired certificate (REQ-NET-012).
Cross-binding tests over every M1 operation: the scope requested equals
ARCHITECTURE.md §6 (REQ-AUTH-005); public operations carry no
`Authorization` (REQ-AUTH-012); key and crypto operations are refused over
`http:` (REQ-NET-003); request headers stay within the allow-list
(REQ-NET-009); every limit violation raises `HemValidationError` with zero
`fetch` calls (REQ-API-005); every binding has a request and response test
(REQ-TEST-001); the docs check passes over the whole surface (REQ-API-007);
the error of a failed authenticated call contains no token (REQ-API-009).
Gate per ARCHITECTURE.md §8: the local check script is green in Node 24 and
in the browser; every M1A REQ carries `implements:` and `verifies:` tags;
the trace matrix is regenerated.

**Definition of done**
- [x] README states the Node and browser requirements, explains the API-version comparison, has the browser section naming `HemOriginRejectedError`, and has the TLS section with a working Node 24 method, an IP-address method and the browser and no-TLS-option statements
- [x] Table test over every M1 operation: the scope requested at login equals the one in ARCHITECTURE.md §6
- [x] Table test: status, version, both check-in steps, both login steps, ext/request and ext/token carry no `Authorization` with tokens cached
- [x] Table test: every key-management and crypto operation on an `http:` client raises `HemTlsRequiredError` with zero `fetch` calls, and every recorded request carries only allow-listed headers
- [x] Table test: every documented limit violation raises `HemValidationError` with zero `fetch` calls and boundary values are accepted
- [x] The error of a failed authenticated call contains no token; every binding has a request and response unit test; the docs check passes over the whole public surface
- [x] A gate: build, type-check and unit suite pass in Node 24 and in a headless browser; every M1A REQ has `implements:` and `verifies:` tags; `requirements/TRACE.md` regenerated
