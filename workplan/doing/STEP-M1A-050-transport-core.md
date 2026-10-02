---
id: STEP-M1A-050
title: Transport core — fetch injection, URL, timeout, abort, headers
milestone: M1A
implements: ["REQ-NET-001", "REQ-NET-002", "REQ-NET-004", "REQ-NET-005", "REQ-NET-006", "REQ-NET-009", "REQ-NET-010"]
traces:
  architecture: ["ARCHITECTURE.md#7-transport", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: ["STEP-M1A-030", "STEP-M1A-040"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `src/transport/` sends one request descriptor (method, path,
optional JSON body, optional bearer token, `requiresTls` flag, per-call
`signal` and `timeoutMs`) through the caller's `fetch` and returns status,
headers and body text, or raises exactly one of `HemTimeoutError`,
`HemAbortError`, `HemUnreachableError`.

**Notes:** `fetch` from options, else `globalThis.fetch`, else
`HemUnsupportedError` at construction. URL = device origin + path prefix +
`/api/…`; a trailing slash is ignored; a username or password in the URL is
rejected with `HemValidationError`. Default time limit 30 000 ms, settable
per transport and per call; the limit covers reading the body; the signal
handed to `fetch` is aborted on timeout and on caller abort, and when both
race the first one decides. A pre-aborted signal never reaches `fetch`.
Headers are limited to `Content-Type` (only with a body), `Authorization`
(only with a token) and `Content-Disposition` (uploads, M3). Requests use
`redirect: "manual"` and a 3xx response is an error. The serialised body is
checked against the 7300-byte limit with the validator from STEP-M1A-040.

**Definition of done**
- [ ] With a supplied `fetch` the global one is never called; without one the global is used; with neither, construction throws `HemUnsupportedError`; `fetch` receives `(url, init)` only
- [ ] `https://my.ence.do`, `https://192.168.7.1`, `http://192.168.7.1`, a URL with a port and an IPv6 literal all target `<origin>/api/…`; a trailing slash makes no difference; a path prefix is kept; credentials in the URL raise `HemValidationError`
- [ ] The default limit is 30 000 ms and is settable per transport and per call; with a never-settling `fetch` and fake timers the call rejects with `HemTimeoutError` and the `fetch` signal is aborted; the limit covers body reading
- [ ] Aborting during the request raises `HemAbortError` and aborts the `fetch` signal; an already-aborted signal rejects without calling `fetch`
- [ ] A rejected `fetch` raises `HemUnreachableError` with the original error as `cause`; when the limit and an abort race, the first to fire decides
- [ ] Only `Content-Type`, `Authorization` and `Content-Disposition` are ever set, each only when applicable
- [ ] Requests disable redirect following; a redirect response raises an error and no second request is made
- [ ] A serialised body over 7300 bytes raises `HemValidationError` before `fetch` is called
