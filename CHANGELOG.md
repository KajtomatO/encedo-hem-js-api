# Changelog

All notable changes to `@kajtomato/encedo-hem-sdk`. Releases are cut at the
B gate of each milestone (ARCHITECTURE.md §10); versions follow semantic
versioning and the public surface only grows between releases.

## 0.2.0 — 2026-10-27

Milestone M2, daily usage and audit logs: implemented and unit-tested in
M2A and verified against a development Encedo HEM (firmware 1.2.2-DIAG) in
M2B. The public surface of 0.1.0 is unchanged; 159 entries are added.

### Operations

- **Keys:** `keys.update` (label and description, both stated; an empty
  description clears it), `keys.import` (an external public key; returns
  its key id), `keys.derive` (ECDH + HKDF on the device from a stored key
  and a peer, `peer: { extKid } | { pubkey }`; returns the new key id).
  `keys.create`, `keys.import` and `keys.derive` send `mode: ECDH` for a
  `SECP*` type unless a mode is given (the device gives such a key no
  usage otherwise); the optional field itself is unchanged.
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
  the parameter and result types of every new call.
- **Release workflow:** tags `v*` are published to npm from GitHub Actions
  through trusted publishing, with a GitHub Release cut from this file.

### Findings from the device that callers must know

- **`SECP*` keys need a usage mode.** A `SECP*` key created without `mode`
  has no usage at all: it can neither sign nor run ECDH (406), and an
  imported `SECP*` public key without a mode cannot be an ECDH peer. The
  library therefore sends `mode: ECDH` for `SECP*` types unless you pass
  one; a signing key needs `ExDSA` or `ECDH,ExDSA`. A raw `SECP*` peer
  must be in compressed X9.63 form.
- **Derive cannot produce a `SECP*` key** on firmware 1.2.2: every such
  target is refused with 406, whatever the mode; `CURVE25519`, `ED25519`,
  AES and HMAC targets derive. Deriving the same source and peer material
  into the same type again is a 406 duplicate, however the peer is given.
  A target type the derive does not support but the firmware knows (for
  example `MLKEM768`) is answered with the source key id and no key; the
  library raises `HemProtocolError` for such a reply.
- **ECDH secrets are 32 bytes** for every curve: the raw output is
  truncated for P-384 and Curve448. Ask for a digest (`alg`) if you need
  the full-width agreement.
- **AES:** the device generates the IV (16 bytes for CBC and GCM) and the
  16-byte GCM tag; CBC output is padded to the block. A wrong tag, other
  AAD, or an algorithm that does not match the key size is a 406.
- **ML-DSA verify** of a bad signature is reported by the firmware with a
  raw code in the HTTP status line (795 observed); on Node the library
  turns it into `false`. Browsers are not yet probed for this case.
  ML-KEM decapsulation echoes the token scope in its `alg` field; the
  library does not expose it.
- **Key generation times:** ML-KEM-768 took 2.5 s and ML-DSA-65 0.3 s,
  inside the default 30 s limit.
- **Audit log:** the file of the current boot is locked (406) until the
  next boot; earlier files download as CRLF text with a `#` banner. The
  logger nonce is time-based (identical within a second).
- **Stability:** the device stopped answering once during a full
  integration run (a P-256 signing) and needed a power cycle; the rerun
  passed. Keep one request in flight and use `minIntervalMs`.

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
