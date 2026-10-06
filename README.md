# encedo-hem-js-api

TypeScript client for the REST API of the **Encedo HEM** hardware security
module. One package runs in Node.js and in browsers. It needs no runtime
dependencies and uses only `fetch` and Web Crypto.

> **Status:** milestone M1, implemented and unit-tested, **not yet verified
> against a device** and not yet published to npm. Device behaviour that the
> library relies on comes from the API reference (`ref/api/hem-api-1.2.2.yaml`)
> and from the device-verified C client,
> https://github.com/KajtomatO/encedo-hem-c-api. This library confirms it on
> hardware in milestone M1B.

## Requirements

<!-- implements: REQ-BUILD-004 -->

- **Node.js 24 or later.** The package declares `"engines": { "node": ">=24" }`.
- **Browsers** whose Web Crypto supports **X25519** (`crypto.subtle` with the
  `X25519` algorithm). The login key is derived and used through Web Crypto;
  without X25519 a login fails with `HemUnsupportedError`.

## Quick start

```ts
import { HemClient } from 'encedo-hem-js-api';

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
`keymgmt:use:<kid>`, so each key you use costs one login. The documentation of
every operation states its scope and the milestone that introduced it.

`client.auth.role` reports whether the device granted the user, master or app
role. `client.auth.logout()` discards the credential and every token.

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

## Checking compatibility with the device firmware

<!-- implements: REQ-API-010 -->

The package exports the API version it was written for, `HEM_API_VERSION`
(`'1.2.2'`). The device reports its firmware through `system.version()`:

```ts
import { HEM_API_VERSION } from 'encedo-hem-js-api';

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
`waitForApproval`, `requestApproval` and `redeemApproval`.
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

All of this comes from the API reference. Whether the cloud relays
(`api.encedo.com`) accept requests from a browser origin is unverified.

## Trusting the device's TLS certificate

<!-- implements: REQ-NET-012 -->

The library has **no TLS option**. TLS trust is the job of the `fetch` you
pass in (`new HemClient({ url, fetch })`). Default trust works when the
device presents a valid public-CA certificate and you address it by the name
in that certificate (for example `https://my.ence.do`). For a private or
self-signed certificate, or for connecting by IP address, supply your own
`fetch`. The library does **not** recover automatically from an expired
device certificate; renew it on the device.

These Node.js 24 methods were tried against a local HTTPS server with a
self-signed CA, through this library. Both use the `undici` package (the
HTTP client inside Node's own `fetch`); add it to your application.

**A certificate the runtime rejects** (private or self-signed CA): trust that
CA for device requests only.

```ts
import { readFileSync } from 'node:fs';
import { Agent, fetch as undiciFetch } from 'undici';

const agent = new Agent({ connect: { ca: readFileSync('device-ca.pem') } });
const hem = new HemClient({
  url: 'https://my.ence.do',
  fetch: (url, init) => undiciFetch(url, { ...init, dispatcher: agent }),
});
```

Without `undici`, `NODE_EXTRA_CA_CERTS=device-ca.pem node app.js` adds the CA
to the trust of the global `fetch` for the whole process.

**Connecting by IP address** (for example `https://192.168.7.1`, where the
certificate names `my.ence.do`): check the certificate against the name it
carries.

```ts
const agent = new Agent({ connect: { servername: 'my.ence.do' } }); // add `ca` too if the CA is private
const hem = new HemClient({
  url: 'https://192.168.7.1',
  fetch: (url, init) => undiciFetch(url, { ...init, dispatcher: agent }),
});
```

**Browsers offer no such override.** A page can reach the device only when
the browser itself trusts the certificate for the address used.

The cloud relays use their own `fetch` (the global one by default), so a
relaxed device `fetch` is never used for `api.encedo.com`.

## Development

```sh
npm install
npx playwright install chromium   # once, for the headless-browser test run
npm run check                     # build, type-check, unit tests in Node 24 and Chromium
```

Unit tests use a substituted `fetch` and need neither a device nor a network.
How work is planned and traced is described in
[REQUIREMENTS-MANAGEMENT.md](REQUIREMENTS-MANAGEMENT.md); the design is in
[ARCHITECTURE.md](ARCHITECTURE.md).

## License

MIT, see [LICENSE](LICENSE).
