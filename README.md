# encedo-hem-js-api

TypeScript client for the REST API of the **Encedo HEM** hardware security
module. One package runs in Node.js and in browsers. It needs no runtime
dependencies and uses only `fetch` and Web Crypto.

> **Status:** version 0.1.0 — milestone M1 implemented, unit-tested and
> **verified against a development device** (firmware 1.2.2) in October 2026;
> published to npm as `@kajtomato/encedo-hem-sdk`. Milestone M2 (daily
> usage and audit logs, see below) is implemented and unit-tested in this
> repository and awaits its hardware verification before 0.2.0. Device
> behaviour that the library relies on comes from the API reference
> (`ref/api/hem-api-1.2.2.yaml`), from the device-verified C client,
> https://github.com/KajtomatO/encedo-hem-c-api, and from this library's own
> device runs. See `CHANGELOG.md`.

## Requirements

<!-- implements: REQ-BUILD-004 -->

- **Node.js 24 or later.** The package declares `"engines": { "node": ">=24" }`.
- **Browsers** whose Web Crypto supports **X25519** (`crypto.subtle` with the
  `X25519` algorithm). The login key is derived and used through Web Crypto;
  without X25519 a login fails with `HemUnsupportedError`.

## Quick start

```sh
npm install @kajtomato/encedo-hem-sdk
```

```ts
import { HemClient } from '@kajtomato/encedo-hem-sdk';

const hem = new HemClient({ url: 'https://my.ence.do', passphrase: process.env.HEM_PASSPHRASE });

const health = await hem.system.health(); // never throws for an unreachable device
if (!health.healthy) throw new Error('HEM not usable right now');

// Create a root key once, and find it again by its description.
const tag = new TextEncoder().encode('om:root:tenant-42');
const [existing] = await hem.keys.findByDescription(tag);
const kid = existing?.kid ?? (await hem.keys.create({ label: 'tenant-42', type: 'AES256', descr: tag }));

// Envelope encryption: wrap a data key with the root key, unwrap it later.
const dataKey = crypto.getRandomValues(new Uint8Array(32));
const wrapped = await hem.crypto.wrap({ kid, msg: dataKey });
const unwrapped = await hem.crypto.unwrap({ kid, msg: wrapped });
```

Every call accepts `{ signal, timeoutMs }` as its last argument. Binary values
are `Uint8Array`; key ids are 32 lower-case hex characters. The device
address (`url`) is a string or a `URL`.

The library never reads environment variables or files. The example reads
the passphrase itself and passes it in.

### Tokens are handled for you

You never pass a token or a scope. Each operation declares the scope it needs.
The client logs in for that exact scope, caches one token per scope in memory
(8 hours by default, `tokenLifetimeSeconds`), renews it 60 seconds before it
expires, and repeats a call once after a `401` (tokens die when the device
reboots). Crypto operations and `keys.get` need the per-key scope
`keymgmt:use:<kid>`, so each key you use costs one login; `keys.delete`
discards the token of the key it removes. The documentation of
every operation states its scope and the milestone that introduced it.

`client.auth.login(scope)` logs in now (or reuses the cached token) and
reports `{ scope, role, expiresAt }`, never the token: a server can confirm
its credentials before it serves traffic. `client.auth.role` reports whether
the device granted the user, master or app role. `client.auth.logout()`
discards the credential and every token.

### Errors

Every failure is a `HemError` with a stable `code`, and where it applies the
HTTP `status` and the `operation`. Subclasses tell the causes apart:
`HemBadRequestError` (400), `HemUnauthenticatedError` (401),
`HemForbiddenError` (403), `HemOperationFailedError` (406),
`HemDeviceStateError` (409), `HemOriginRejectedError` (412),
`HemPayloadTooLargeError` (413), `HemTlsRequiredError` (418, or a key or
crypto call on an `http:` URL), `HemDeviceError` (500 and anything
unexpected), `HemTimeoutError`, `HemUnreachableError`, `HemAbortError`,
`HemValidationError` (input refused before sending), `HemProtocolError`,
`HemUnsupportedError`, `HemApprovalRejectedError`, `HemApprovalTimeoutError`
and `HemRelayError` (a cloud relay failed). Errors never contain the
passphrase, a login proof or a token.

## Daily usage: signatures, encryption, key exchange, audit logs

Milestone M2 adds the remaining key-management and crypto operations, the
configuration read and the audit log. Every call below needs the per-key
scope `keymgmt:use:<kid>` unless stated otherwise, and is refused over
plain HTTP. Not yet verified on hardware; see the status above.

```ts
// Keys: rename, import a peer's public key, derive a shared key on the device.
await hem.keys.update({ kid, label: 'tenant-42', descr: tag });      // descr is always stated; an empty array clears it
const peerKid = await hem.keys.import({ label: 'peer', pubkey: peerPublicKey, type: 'CURVE25519' });
const shared = await hem.keys.derive({ kid: myX25519Kid, label: 'shared', type: 'AES256', peer: { extKid: peerKid } });

// Signatures (ECDSA / EdDSA) and MACs: verification happens on the device.
const signature = await hem.crypto.sign({ kid: edKid, msg, alg: 'Ed25519' });
const ok = await hem.crypto.verify({ kid: edKid, msg, sign: signature, alg: 'Ed25519' }); // true | false
const macOk = await hem.crypto.hmacVerify({ kid, msg, mac });

// AES: the device generates the IV; the result carries what decryption needs.
const { ciphertext, iv, tag: gcmTag } = await hem.crypto.encrypt({ kid, msg, alg: 'AES256-GCM', aad });
const plaintext = await hem.crypto.decrypt({ kid, msg: ciphertext, alg: 'AES256-GCM', iv, tag: gcmTag, aad });

// Key exchange: ECDH, and post-quantum ML-KEM / ML-DSA.
const secret = await hem.crypto.ecdh({ kid: myX25519Kid, peer: { pubkey: peerPublicKey } });
const { sharedSecret, ciphertext: kemCt } = await hem.crypto.mlkemEncaps({ kid: kemKid });
const sameSecret = await hem.crypto.mlkemDecaps({ kid: kemKid, ct: kemCt });
const { signature: pq } = await hem.crypto.mldsaSign({ kid: dsaKid, msg });
const pqOk = await hem.crypto.mldsaVerify({ kid: dsaKid, msg, sign: pq });
```

- **Verify operations return `true` or `false`** and raise only for other
  failures. The device answers an invalid signature or MAC with the same
  status it uses for a missing or unsuitable key, so `false` covers those
  too. ML-DSA verify is special: firmware 1.2.2 reports a failed check with
  a raw internal code in the HTTP status line, so every completed response
  other than a success or an authentication failure counts as `false`.
- **`SECP*` keys need a usage mode.** The device gives a `SECP*` key created
  without `mode` no usage at all (it can neither sign nor run ECDH), so
  `keys.create`, `keys.import` and `keys.derive` send `mode: 'ECDH'` for
  those types unless you pass one; a signing key needs `mode: 'ExDSA'` or
  `'ECDH,ExDSA'`. Other types never get a mode.
- **Agreed-key mode.** HMAC, HMAC verify, encrypt, decrypt, wrap and unwrap
  accept `peer: { extKid } | { pubkey }`: the device runs ECDH between your
  stored key and the peer and derives the working key itself (through
  HKDF-SHA256 with an optional `ctx` of up to 64 bytes for the cipher and
  wrap operations; HMAC then needs `alg`). The token scope stays that of
  your key.
- **Configuration read:** `hem.system.config()` (scope `system:config`)
  returns the owner, hostname and address, origin allow-list, option flags
  and identity keys. Configuration write comes with M3.
- **Audit log** (scope `logger:get`): `hem.logger.key()` gives the
  verification key and a signed nonce; `hem.logger.list({ offset })` pages
  the file ids; `hem.logger.download(id)` returns one file **byte for byte**
  with a `text()` view — the library never parses log lines, because the
  integrity chain is computed over the exact bytes. Listing and download
  exist only on hardware with mass storage; elsewhere they raise
  `HemUnsupportedError`.

## Checking compatibility with the device firmware

<!-- implements: REQ-API-010 -->

The package exports the API version it was written for, `HEM_API_VERSION`
(`'1.2.2'`). The device reports its firmware through `system.version()`:

```ts
import { HEM_API_VERSION } from '@kajtomato/encedo-hem-sdk';

const { fwv } = await hem.system.version(); // the firmware name from the signed image
if (!fwv.includes(HEM_API_VERSION)) {
  console.warn(`HEM firmware "${fwv}" may not match API ${HEM_API_VERSION}`);
}
```

`fwv` is the firmware name from the signed image footer. The reference does
not define its format. The check above assumes the name contains the version
number. Confirm that on your device; hardware verification (M1B) will record
the real value.

## The device clock and check-in

Login fails with `403` while the device clock is not set. The clock is not
set after a cold boot or a wipe, and it runs fast. Only a **check-in** with
the Encedo backend sets it. By default the client runs one check-in through
`https://api.encedo.com/checkin` when a login fails for that reason, then
logs in again. Your process therefore needs outbound access to
`api.encedo.com`. `client.system.checkin()` runs a check-in on demand.
`checkinRelay` replaces the backend path; `checkinRelay: null` or
`clockRecovery: false` disables it.

A check-in reply can carry management actions (lock, wipe, soft-brick, forced
upgrade). The device runs them when its trusted-backend option is on. See the
documentation of `system.postCheckin`.

## Mobile approval

A paired Encedo mobile app can approve access instead of a passphrase:
`new HemClient({ url, mobileApproval: true })`. Each token is then requested
from the phone through the Encedo notification broker
(`https://api.encedo.com/notify`). The broker learns your IP address. The
lower-level steps are `client.auth.beginApproval`, `pollApproval`,
`waitForApproval`, `requestApproval` and `redeemApproval`; an approved
request yields `{ scope, role, expiresAt }`, never the token.
`approvalRelay` replaces the broker.

## Using the library in a browser

<!-- implements: REQ-NET-011 -->

A browser adds an `Origin` header to every request. The device checks that
origin against its **origin allow-list** and answers **`412`** when it is not
on the list. Any endpoint can do this. The library raises
**`HemOriginRejectedError`** for a 412. It cannot change the list for you:
**putting your page's origin on the device's allow-list is your
responsibility.**

- **Where the list is set:** the `origin` field of the device configuration.
  It is given once at provisioning (`POST /api/auth/init`). It can be changed
  later through a configuration write (`POST /api/system/config`, scope
  `system:config`). This library adds configuration write in M3; until then,
  use another tool to change the list.
- **Match syntax:** `*` (any origin), an exact origin such as
  `https://app.example.com`, or a wildcard subdomain such as
  `*.example.com`.
- The device's CORS preflight allows only the headers `Content-Type`,
  `Cache-Control`, `Pragma`, `Expires`, `Authorization` and
  `Content-Disposition`. The library sends nothing else.

- **The browser asks the user first.** The device sits on a local address
  (`192.168.7.1`, also behind `my.ence.do`). Chromium-based browsers let a
  page from any other origin reach a local address only after the user
  allows "local network access" for that site; until then every device call
  fails with `HemUnreachableError` before anything is sent. A page served
  by the device itself is not affected.

Verified on a device (firmware 1.2.2) from headless Chromium 153: with
local network access allowed, pages at `https://app.example` and
`http://localhost:8080` logged in, listed keys and ran a check-in; the
device's preflight allowed the request, and both cloud relays
(`api.encedo.com/checkin` and `/notify`) accept browser origins.

## Trusting the device's TLS certificate

<!-- implements: REQ-NET-012 -->

The library has **no TLS option**. TLS trust is the job of the `fetch` you
pass in (`new HemClient({ url, fetch })`). Default trust works when the
device presents a valid public-CA certificate and you address it by the name
in that certificate (for example `https://my.ence.do`). For a private or
self-signed certificate, or for connecting by IP address, supply your own
`fetch`. The library does **not** recover automatically from an expired
device certificate; renew it on the device.

On Node.js the library does not use Node's built-in `fetch` for the device
at all: firmware 1.2.2 matches header names case-sensitively, and Node's
`fetch` writes its `content-length` in lowercase, which the device answers
with 411. By default the client therefore sends through `node:https` with
the names spelled as the device expects, with system trust. For other
trust, `createNodeFetch` builds a `fetch` on that same transport (both
methods below were tried against a local HTTPS server with a self-signed
certificate, through this library):

**A certificate the runtime rejects** (private or self-signed CA): trust that
CA for device requests only.

```ts
import { readFileSync } from 'node:fs';
import { HemClient, createNodeFetch } from '@kajtomato/encedo-hem-sdk';

const hem = new HemClient({
  url: 'https://my.ence.do',
  fetch: createNodeFetch({ ca: readFileSync('device-ca.pem') }),
});
```

Alternatively, `NODE_EXTRA_CA_CERTS=device-ca.pem node app.js` adds the CA to
Node's trust for the whole process, which the default transport uses too.

**Connecting by IP address** (for example `https://192.168.7.1`, where the
certificate names `my.ence.do`): check the certificate against the name it
carries.

```ts
const hem = new HemClient({
  url: 'https://192.168.7.1',
  fetch: createNodeFetch({ servername: 'my.ence.do' }), // add `ca` too if the CA is private
});
```

`createNodeFetch({ rejectUnauthorized: false })` accepts any certificate —
for a laboratory only.

**Browsers offer no such override.** A page can reach the device only when
the browser itself trusts the certificate for the address used. Browsers
use their own `fetch`, which spells header names as the device expects; the
`node:https` and `node:http` imports exist only for Node and are dynamic —
if your bundler complains about them, mark them external.

The cloud relays use their own `fetch` (the global one by default), so a
relaxed device `fetch` is never used for `api.encedo.com`.

## Development

```sh
npm install
npx playwright install chromium   # once, for the headless-browser test run
npm run check                     # build, type-check, unit tests in Node 24 and Chromium
```

Unit tests use a substituted `fetch` and need neither a device nor a network.

### Device tests

Tests under `tests/integration/` talk to a real HEM. They are never part of
`npm test`, `npm run check` or CI; they have their own command and are
skipped — reported as skipped, not failed — unless `EHEM_TEST_URL` is set:

```sh
export EHEM_TEST_URL=https://my.ence.do
export EHEM_TEST_PASSPHRASE='…'
export EHEM_TEST_INSECURE=1        # or EHEM_TEST_CACERT=/path/to/ca.pem; default: system trust
export EHEM_TEST_PACE_MS=150       # minimum interval between device requests; default 150
npm run test:integration
```

Keep the exports in `hem.env` (git-ignored) and source it before a run. The
variable names are those of the C client
(https://github.com/KajtomatO/encedo-hem-c-api), so one file serves both.
Only the test harness reads them; the library never reads the environment.

Tests under `tests/attended/` need a person at the device or the phone: they
push notifications, or wait for a power cycle. Each needs
`EHEM_ALLOW_DISRUPTIVE=1` in addition, is started by file, and prints what it
is about to do before doing it:

```sh
EHEM_ALLOW_DISRUPTIVE=1 npm run test:attended -- tests/attended/<name>.test.ts
```

Device tests create keys only with labels starting with `EHEMTEST` and delete
them afterwards; no other key on the device is modified.

How work is planned and traced is described in
[REQUIREMENTS-MANAGEMENT.md](REQUIREMENTS-MANAGEMENT.md); the design is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## License

MIT, see [LICENSE](LICENSE).
