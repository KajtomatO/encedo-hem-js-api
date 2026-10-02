# encedo-hem-js-api

TypeScript client for the REST API of the Encedo HEM hardware security
module. One package for Node.js and browsers: it uses only `fetch` and Web
Crypto and has no runtime dependencies.

Status: milestone M1A — implemented and unit-tested, **not yet verified
against a device** (that is milestone M1B). Not published to npm yet.

## Requirements

<!-- implements: REQ-BUILD-004 -->

- **Node.js 24 or later.**
- **Browsers** whose Web Crypto supports X25519 (`crypto.subtle` with the
  `X25519` algorithm), which the login needs. Current Chromium is tested.

## Quick start

```js
import { HemClient } from "encedo-hem-js-api";

const hem = new HemClient({
  url: "https://my.ence.do",
  passphrase: process.env.HEM_PASSPHRASE, // read by your code, never by the library
});

const health = await hem.system.health();
if (!health.healthy) throw new Error("HEM not ready");

const [root] = await hem.keys.findByDescription(new TextEncoder().encode("tenant-root"));
const kid = root?.kid ?? (await hem.keys.create({
  label: "tenant-root",
  type: "AES256",
  description: new TextEncoder().encode("tenant-root"),
}));

const dek = crypto.getRandomValues(new Uint8Array(32));
const wrapped = await hem.crypto.wrap({ kid, data: dek });
const unwrapped = await hem.crypto.unwrap({ kid, data: wrapped });
```

The client logs in by itself (PBKDF2 → X25519 → signed proof), keeps one
token per scope in memory, renews it before expiry, logs in again after a
401 (for example after a device reboot), and runs a check-in through
`api.encedo.com` when the device clock is unset or has drifted. Every call
accepts `{ signal, timeoutMs }`; binary values are `Uint8Array`; failures are
`HemError` subclasses with a stable `code`.

## Checking the API version

<!-- implements: REQ-API-010 -->

`HEM_API_VERSION` is the API version this library targets (`"1.2.2"`).
The device reports its firmware in `system.version().fwv`. Compare the two
before relying on the device:

```js
import { HEM_API_VERSION } from "encedo-hem-js-api";

const { fwv } = await hem.system.version();
if (!fwv.includes(HEM_API_VERSION)) {
  console.warn(`device firmware "${fwv}" differs from the targeted API ${HEM_API_VERSION}`);
}
```

`fwv` is the firmware name from the signed image, so match the version
number inside it rather than comparing the whole string.

## Browser use and the device's origin allow-list

<!-- implements: REQ-NET-011 -->

A browser adds an `Origin` header to every request. The device compares it
with its `origin` allow-list and answers **412** when it does not match;
the library reports that as `HemOriginRejectedError`.

- The allow-list is set when the device is **provisioned**, and changed
  later through a **configuration write** (`POST /api/system/config`,
  available in this library from milestone M3).
- Entries are `*` (any origin), an exact origin such as
  `https://app.example.com`, or a wildcard subdomain `*.example.com`.
- Putting the page's origin on the list is the caller's job; the library
  does not change device configuration on your behalf.

The library sends only `Content-Type` and `Authorization` headers to the
device, both inside what the device's CORS preflight allows. Whether the
Encedo cloud services used for check-in and mobile approval accept browser
origins is not yet verified.

## TLS trust: bring your own `fetch`

<!-- implements: REQ-NET-012 -->

The library has **no TLS settings**. Trust is decided by the `fetch` you
pass (`options.fetch`, default `globalThis.fetch`). A device addressed as
`my.ence.do` with a valid public certificate needs nothing. Otherwise, in
Node.js 24:

**A certificate the runtime does not trust** (private CA, self-signed):
either start Node with the CA added to its store,

```sh
NODE_EXTRA_CA_CERTS=/path/to/device-ca.pem node app.js
```

or give the client a `fetch` with its own trust, using the `undici` package
(the library behind Node's `fetch`):

```js
import { readFileSync } from "node:fs";
import { Agent } from "undici";

const dispatcher = new Agent({ connect: { ca: readFileSync("/path/to/device-ca.pem") } });
const hem = new HemClient({
  url: "https://my.ence.do",
  fetch: (url, init) => fetch(url, { ...init, dispatcher }),
});
```

**Connecting by IP address** (the certificate names `my.ence.do`, not
`192.168.7.1`): check the certificate against the name it was issued for.

```js
import { checkServerIdentity } from "node:tls";
import { Agent } from "undici";

const dispatcher = new Agent({
  connect: {
    servername: "my.ence.do",
    checkServerIdentity: (_host, cert) => checkServerIdentity("my.ence.do", cert),
  },
});
const hem = new HemClient({
  url: "https://192.168.7.1",
  fetch: (url, init) => fetch(url, { ...init, dispatcher }),
});
```

Notes:

- **Browsers offer no such override**: the page can only reach a device
  whose certificate the browser already trusts.
- The library does **not recover automatically from an expired device
  certificate**; supply a `fetch` that accepts it, or renew the certificate.
- The relays to `api.encedo.com` use their own `fetch` (the global one by
  default), never the device `fetch`, so relaxed device trust never applies
  to the cloud.

These recipes are checked against a real device in milestone M1B.

## Development

```sh
npm ci
npx playwright install chromium
npm run check      # build, type-check, unit tests in Node and headless Chromium
```

Unit tests run without a device or network. Requirements, workplan and
traceability are described in `REQUIREMENTS-MANAGEMENT.md` and
`ARCHITECTURE.md`.

## License

MIT
