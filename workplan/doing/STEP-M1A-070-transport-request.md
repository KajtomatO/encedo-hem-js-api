---
id: STEP-M1A-070
title: Transport — fetch injection, device URL, HTTPS guard, headers, redirects
milestone: M1A
implements: ["REQ-NET-001", "REQ-NET-002", "REQ-NET-003", "REQ-NET-009", "REQ-NET-010"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#3-component-overview"]
depends_on: ["STEP-M1A-040"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** A transport built from the client options sends one request
through the caller's `fetch` to the right URL with only the allowed headers,
refuses TLS-only requests on an `http:` device URL, and does not follow
redirects.

**Notes:**
- `src/transport/`. The transport knows nothing about JSON shapes, scopes or
  tokens (ARCHITECTURE.md §3). Its caller hands it a method, a path, an
  optional body, an optional bearer string and a "TLS only" flag.
- `fetch` is chosen at construction: the supplied one, otherwise
  `globalThis.fetch`; with neither, construction throws
  `HemUnsupportedError`. It is called with `(url, init)` only.
- The device URL is parsed once: scheme `http:` or `https:`, no username or
  password, trailing slash ignored, path prefix kept; requests go to
  `<base>/api/…`.
- Headers: `Content-Type` only with a body, `Authorization` only when a
  bearer is given, `Content-Disposition` only for uploads (none in M1).
- Redirects are not followed. What `fetch` hands back for a redirect when
  following is disabled is not the same in every runtime; the code and the
  tests cover both a 3xx status and an opaque redirect response. The error
  class is `HemDeviceError` (unexpected status).
- Closed elsewhere: REQ-NET-003 "every key-management and crypto operation"
  and REQ-NET-009 "every binding's request" in STEP-M1A-230; both REQs are
  listed there too. The 418 mapping itself comes from STEP-M1A-040.

**Definition of done**
- [ ] With a supplied `fetch` the global one is never called (the test
      replaces the global with one that throws); without one, the global is
      used; with neither, construction throws `HemUnsupportedError`.
- [ ] The supplied function receives the standard `(url, init)` arguments
      only.
- [ ] Requests for `https://my.ence.do`, `https://192.168.7.1`,
      `http://192.168.7.1`, a URL with a port and an IPv6 literal all go to
      `<origin>/api/…`; a trailing slash makes no difference; a path prefix
      is kept in front of `/api/…`.
- [ ] A URL carrying a username or password is rejected with
      `HemValidationError`.
- [ ] A request flagged TLS-only on an `http:` base raises
      `HemTlsRequiredError` with zero `fetch` calls; an unflagged request on
      `http:` is sent; a 418 response raises `HemTlsRequiredError`.
- [ ] Recorded request headers contain only `Content-Type` (only with a
      body), `Authorization` (only when a bearer is supplied) and
      `Content-Disposition` (only for uploads).
- [ ] Requests are made with redirect following disabled; a redirect response
      raises an error and no second request is made.
- [ ] The suite passes in Node 24 and in the browser run.
- [ ] `implements:` and `verifies:` tags exist for the REQs above.
- [ ] The non-`(M1B)` acceptance boxes this step closes are ticked in the REQ
      files (revision bumped).
