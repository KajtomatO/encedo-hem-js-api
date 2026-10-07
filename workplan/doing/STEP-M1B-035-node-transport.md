---
id: STEP-M1B-035
title: Node.js transport — node:https with the header names the device requires
milestone: M1B
implements: ["REQ-NET-013", "REQ-BUILD-003", "REQ-NET-001", "REQ-NET-012", "REQ-TEST-001"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#8-testing-policy"]
depends_on: ["STEP-M1B-020"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** On Node.js a client built without a `fetch` logs in and runs every
M1 operation against firmware 1.2.2: device requests go through
`node:https` with `Content-Length`, `Content-Type` and `Authorization`
spelled exactly as the device matches them (§6 quirk 18), one connection
per request (quirk 19). `createNodeFetch()` gives Node callers custom TLS
trust on the same transport. Browsers are untouched.

**Notes:**
- Inserted after the STEP-M1B-030 finding of 2026-10-07 (user decision B1:
  the library handles it itself, as Encedo's hem-sdk-js does). The four
  amended REQs listed above are in `needs-reverify`; this step re-verifies
  them.
- `src/transport/node-https.ts`: a `FetchFunction` over `node:https`.
  Dynamic `await import('node:https')` on first use, through the module's
  default export (so a test can replace `https.request`); `agent: false`;
  `init.signal` passed to `request()`; headers taken from `init.headers` as
  spelled by the transport, `Content-Length` added from the body; the
  reply is a response-shaped object (`status`, `ok`, `headers`,
  `arrayBuffer()`) rather than `new Response()`, which rejects statuses
  outside 200–599 (quirk 3). Node detection: `process.versions.node`.
- `Transport`: default `fetch` = caller's, else `nodeHttpsFetch()` on Node,
  else `globalThis.fetch`. `createNodeFetch(options)` exported from the
  package root; it throws `HemUnsupportedError` outside Node.
- Static checks (`tests/support/source-check.ts`, `source-tree.node.test.ts`,
  `package.node.test.ts`): exempt exactly that file for the dynamic
  `node:` import and `process`; the dist import check learns the same.
- Unit tests, Node only, against local servers on 127.0.0.1: `node:http`
  for `rawHeaders` spelling, fresh socket per request, status 795
  pass-through, abort and timeout; `node:https` with a committed
  self-signed certificate under `tests/fixtures/tls/` (generated once with
  openssl, long validity, test-only) for `ca`, `servername` and
  `rejectUnauthorized`. Without `ca` the self-signed server must fail with
  `HemUnreachableError`.
- Guard (REQ-TEST-001): a Node-only setup file blocks `https.request` and
  `http.request` to anything but 127.0.0.1 and fails the test, like the
  `fetch` guard.
- Browser run: nothing from `node:` may load; check the Vite output for the
  dynamic import (externalised, never executed).
- Harness: `device-env.ts` builds the client with `createNodeFetch` from
  `EHEM_TEST_INSECURE` / `EHEM_TEST_CACERT`; `undici` removed from
  devDependencies; STEP-M1B-030's reach tests use `createNodeFetch` for
  the CA and IP cases.
- README: the TLS section shows `createNodeFetch({ ca })` and
  `createNodeFetch({ servername: 'my.ence.do' })`, keeps "no TLS option"
  and "browsers offer no override"; `readme.node.test.ts` follows. The
  surface snapshot grows by `createNodeFetch` and its options type.
- Bundlers for browsers may need `node:https`/`node:http` marked external;
  say so in the README.

**Definition of done**
- [ ] A request with a body from a Node client without `fetch` reaches a
      local server with `Content-Length`, `Content-Type`, `Authorization`
      spelled exactly so and no `transfer-encoding`; each request on a new
      socket.
- [ ] Time limit, cancellation, `HemUnreachableError`, no redirect
      following and status 795 pass-through hold on the Node transport.
- [ ] `createNodeFetch` honours `ca`, `servername`, `rejectUnauthorized`
      against the local TLS fixture and throws `HemUnsupportedError` outside
      Node.
- [ ] A supplied `fetch` is used for everything; on Node the global `fetch`
      is never called by a client without one.
- [ ] The Node unit run blocks `node:https`/`node:http` beyond loopback; the
      browser run loads nothing from `node:`.
- [ ] Static checks pass with the single exemption; the surface snapshot
      changes only by the new export; README and its test updated;
      `undici` gone; harness switched to `createNodeFetch`.
- [ ] `npm run check` green in Node 24 and Chromium; `implements:` and
      `verifies:` tags for the five REQs; their non-`(M1B)` boxes ticked
      (revisions bumped).
