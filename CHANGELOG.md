# Changelog

All notable changes to `@kajtomato/encedo-hem-sdk`. Releases are cut at the
B gate of each milestone (ARCHITECTURE.md §10); versions follow semantic
versioning and the public surface only grows between releases.

## 0.1.0 — 2026-10-20

First release: milestone M1, implemented in M1A and verified against a
development Encedo HEM (firmware 1.2.2-DIAG) in M1B.

### Operations

- **Session:** `auth.login(scope)` (reports `{ scope, role, expiresAt }`,
  never the token), `auth.role`, `auth.logout()`; passphrase login happens
  implicitly at the first operation that needs a token, one cached token per
  scope, renewed before expiry, repeated once after a 401, with automatic
  clock recovery through check-in.
- **Mobile approval:** `auth.requestApproval`, `auth.redeemApproval`,
  `auth.beginApproval`, `auth.pollApproval`, `auth.waitForApproval`,
  `auth.approve`, the `mobileApproval` client option (every token obtained
  from the paired phone) and the `approvalRelay` option with a default relay
  for the Encedo notification broker.
- **System:** `system.status`, `system.version`, `system.health`,
  `system.getCheckin`, `system.postCheckin`, `system.checkin` (with a default
  relay for the Encedo check-in backend and the `checkinRelay` option).
- **Keys:** `keys.create`, `keys.get`, `keys.list`, `keys.listAll`,
  `keys.search`, `keys.findByDescription`, `keys.delete`.
- **Crypto:** `crypto.hmac`, `crypto.wrap`, `crypto.unwrap`.
- **Transport:** `createNodeFetch` for Node.js (the default there), with
  custom TLS trust; typed errors (`HemError` and its subclasses);
  `HEM_API_VERSION`.

### Findings from the device that callers must know

- Node's built-in `fetch` cannot talk to the device: the firmware matches
  header names case-sensitively and rejects the lowercase `content-length`
  undici writes. On Node the library uses its own `node:https` transport.
- The device closes the connection after every response although it
  advertises keep-alive; the Node transport opens one connection per request.
- Passphrase tokens are issued for exactly the requested lifetime (8 hours
  by default; 7 days was accepted). Tokens approved on the phone lived 1 hour.
- The device clock runs about 8 % fast and is cleared by any restart. The
  library recovers by itself with one check-in, which needs outbound HTTPS to
  `api.encedo.com`. The approval broker refuses a request whose device
  timestamp is ahead of its clock; the library then checks in and resubmits,
  which is invisible on the phone.
- The Encedo app shows a push for a scope it does not know (for example
  `keymgmt:search`) with nothing to reject, so such a wait always times out;
  ask for `keymgmt:list` or `keymgmt:use:<kid>`.
- Key search compares the stored bytes, not their base64 text; a search
  without a match reports `total` equal to the repository size.
- Two parallel connections were served; keep concurrency low and use
  `minIntervalMs` if the device stalls under load.
- In a browser, the page's origin must be on the device's allow-list, and
  Chromium needs the Local Network Access permission for a device on the
  local network.
