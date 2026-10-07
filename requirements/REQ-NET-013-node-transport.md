---
id: REQ-NET-013
title: Node.js transport that spells header names as the device requires
status: approved
priority: must
revision: 1
source: device finding 2026-10-07 (STEP-M1B-030; firmware matches header names case-sensitively); user decision 2026-10-07 (the library handles it itself); https://github.com/encedo/hem-sdk-js (same approach in Encedo's SDK)
depends_on: ["REQ-NET-001", "REQ-NET-009"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#1-decisions-fixed"]
---

# Node.js transport that spells header names as the device requires

On Node.js, when no `fetch` is supplied, the client SHALL send device
requests through `node:https` with `Content-Length` spelled in that exact
case, one connection per request.

**Rationale:** Firmware 1.2.2 matches header names case-sensitively
(ARCHITECTURE.md §6 quirk 18): a request whose `Content-Length` arrives as
`content-length` is answered with 411. Node's built-in `fetch` (undici)
always writes the `content-length` it generates in lowercase and lets no
caller override it, so every request with a body fails from Node — the
login proof first of all. Browsers and libcurl spell the names as the device
expects, and a caller-supplied `fetch` stays the caller's business
(REQ-NET-001). Encedo's own JavaScript SDK takes the same way out. The
device also closes the socket after each response while advertising
keep-alive (quirk 19), so the transport reuses none. Introduced in M1B.

**Acceptance criteria:**
- [ ] On Node.js without a supplied `fetch`, a request with a body arrives at
      a local server with `Content-Length`, `Content-Type` and
      `Authorization` spelled exactly so, and without `transfer-encoding`.
- [ ] Each request uses a new connection.
- [ ] The time limit and cancellation (REQ-NET-004, REQ-NET-005) apply to
      this transport; a connection failure maps to `HemUnreachableError`;
      redirects are not followed.
- [ ] A status outside 200–599 is passed through unchanged (§6 quirk 3).
- [ ] `createNodeFetch({ ca, servername, rejectUnauthorized })` is exported:
      the same transport with custom TLS trust, for passing as `fetch`; it
      throws `HemUnsupportedError` outside Node.js.
- [ ] A caller-supplied `fetch` is used for every request, as before.
- [ ] The browser run of the unit suite loads nothing from `node:`.
- [ ] (M1B) a login — a POST — succeeds on Node.js against the device
      through the default transport.
