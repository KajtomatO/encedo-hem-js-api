# Changelog

All notable changes to `@kajtomato/encedo-hem-sdk`. Releases are cut at the
B gate of each milestone (ARCHITECTURE.md §10); versions follow semantic
versioning and the public surface only grows between releases.

## Unreleased — 0.2.0

Milestone M2, daily usage and audit logs: implemented and unit-tested
(M2A); the release follows its hardware verification (M2B).

### Operations

- **Keys:** `keys.update` (label and description, both stated; an empty
  description clears it), `keys.import` (an external public key; returns
  its key id), `keys.derive` (ECDH + HKDF on the device from a stored key
  and a peer, `peer: { extKid } | { pubkey }`; returns the new key id).
- **Signatures and MACs:** `crypto.sign` and `crypto.verify` (ECDSA with
  SHA-256/384/512, Ed25519, Ed25519ph, Ed25519ctx, Ed448, Ed448ph),
  `crypto.hmacVerify`. Verify operations return `true` or `false`; `false`
  also covers a missing or unsuitable key.
- **AES:** `crypto.encrypt` and `crypto.decrypt` in ECB, CBC and GCM mode
  with AES-128/192/256; the device generates the IV and returns it with the
  GCM tag.
- **Key exchange:** `crypto.ecdh` (raw secret, reported as 32 bytes, or its
  digest), `crypto.mlkemEncaps` and `crypto.mlkemDecaps` (ML-KEM-512/768/
  1024; decapsulation hides the firmware's unreliable `alg` field),
  `crypto.mldsaSign` and `crypto.mldsaVerify` (ML-DSA-44/65/87; a failed
  verification arrives as a raw status code and is reported as `false`).
- **Agreed-key mode:** HMAC, HMAC verify, encrypt, decrypt, wrap and unwrap
  accept a `peer` (and, for the cipher and wrap operations, a `ctx` of up to
  64 bytes); the device derives the working key by ECDH and HKDF-SHA256.
- **System:** `system.config()` — the device configuration and identity keys
  (read-only; scope `system:config`).
- **Audit log:** `logger.key()`, `logger.list({ offset })`,
  `logger.download(id)` (the file byte for byte, with a `text()` view;
  scope `logger:get`). Listing and download need mass-storage hardware and
  raise `HemUnsupportedError` where the device answers 404.
- **Constants and types:** `IMPORTABLE_KEY_TYPES`, `DERIVABLE_KEY_TYPES`,
  `SIGNATURE_ALGORITHMS`, `CIPHER_ALGORITHMS`, `HASH_ALGORITHMS`,
  `MLKEM_CIPHERTEXT_BYTES`, `MLDSA_SIGNATURE_BYTES`, the size limits, and
  the parameter and result types of every new call. The public surface of
  0.1.0 is unchanged.

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
