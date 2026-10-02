# Encedo HEM JS library: high-level requirements

Status: draft. API reference: `ref/api/hem-api-1.2.2.yaml` (Encedo nGINE REST API, firmware 1.2.2, 58 operations).

## 1. Purpose and scope

A JavaScript library that lets an application use an Encedo HEM hardware security module through the device's REST API. Its first consumer is an Open Mercato integration that replaces HashiCorp Vault as the source of tenant data-encryption keys.

In scope:

- A client for the REST API described in the reference above, delivered in three milestones (sections 3 to 5).
- The client-side cryptography that the API's authentication flows require.

Out of scope:

- PKCS#11 and any native code.
- Endpoints that exist only in diagnostic firmware builds.
- Endpoints not described in the 1.2.2 reference.
- The Open Mercato integration itself (key-provider logic, caching of data keys, migration tooling).
- The device's static web dashboard (non-`/api/` paths).

## 2. General requirements (all milestones)

### 2.1 Platform and packaging

- **G1.** Written in TypeScript, published as JavaScript (ESM) with type declarations.
- **G2.** Pure JavaScript at runtime: no native addons, no PKCS#11, no runtime dependencies.
- **G3.** Built only on `fetch` and Web Crypto, so the same package runs on Node.js (current LTS releases) and in modern browsers.
- **G4.** Each milestone is a usable, versioned release; later milestones add to the public API without breaking earlier ones.

### 2.2 Connection

- **G5.** The device address is configurable (hostname or IP; the device may be on a USB virtual network link or reachable over a network).
- **G6.** The caller can supply its own `fetch` implementation, so that TLS trust for the device certificate, proxies and test doubles are under the caller's control.
- **G7.** Every call supports a timeout and cancellation. Defaults account for the device's deliberate response delays on login (0.5 to 1.5 s).
- **G8.** Key-management and cryptography calls are made over HTTPS only; the library refuses to send them over plain HTTP.

### 2.3 Authentication and tokens

- **G9.** The library obtains bearer tokens through the device's authentication flows and attaches them to calls; the caller does not build tokens by hand.
- **G10.** A token carries one scope, and cryptography calls need the exact scope `keymgmt:use:<kid>` for the key they use. The library therefore manages a set of tokens, one per scope, and selects the right one for each call.
- **G11.** Tokens are renewed before expiry (default lifetime 8 hours, configurable up to what the device allows) and re-obtained after a 401, since all tokens become invalid when the device reboots.
- **G12.** Both device roles are supported for local login: user (required for key-management and cryptography) and master (administrative operations only).
- **G13.** Credentials and tokens are held in memory only. The library never logs or persists them.

### 2.4 Errors and device behaviour

- **G14.** Device responses are mapped to typed errors that distinguish at least: bad request (400), unauthenticated (401), forbidden (403), operation refused or failed (406), device busy or wrong state (409), origin rejected (412), payload too large (413), TLS required (418), device error (500), and transport failures (timeout, unreachable).
- **G15.** Error responses with empty bodies are handled everywhere.
- **G16.** The firmware quirks documented in the reference are handled so callers see consistent behaviour (for example: 409 instead of 418 on some endpoints over plain HTTP, the unreliable `alg` field in ML-KEM decapsulation, non-standard status codes on failed ML-DSA verification, the key-derivation call that echoes the source key id for an unrecognised type).
- **G17.** Inputs are validated before sending where the reference gives hard limits: key ids (32 hex characters), labels (32 characters), descriptions (64 bytes), JSON body size (7300 bytes), message size (2048 bytes).
- **G18.** Binary values are accepted and returned as byte arrays; base64 and hex conversion is the library's job.

### 2.5 Capability awareness

- **G19.** The library targets API version 1.2.2 and lets the caller read the device's hardware and firmware version to check compatibility.
- **G20.** Endpoints that exist only on hardware with mass storage ("MSC build only" in the reference) are identified as such in the library's documentation and fail with a clear error on other hardware.

### 2.6 Quality

- **G21.** Unit tests run without a device, using a substituted `fetch`.
- **G22.** An opt-in integration test suite runs against a real device.
- **G23.** Every public operation is documented with the scope it needs and the milestone that introduced it.

## 3. Milestone 1: MVP

**Goal.** Everything the Open Mercato integration needs to replace Vault: a headless server process can authenticate, locate or create its root keys, derive or wrap/unwrap data-encryption keys, and report device health. A human can alternatively approve access from a paired mobile app.

**Complete when** a consumer can, using only this library: log in with a passphrase without human interaction; request and redeem a mobile-app approval; keep working across token expiry and device reboot; create a root key and find it again by description; compute an HMAC with a stored key; wrap and unwrap a data key with a stored AES key; and check that the device is initialised, healthy and reachable.

| Area | Operation | Purpose |
|---|---|---|
| Auth | `GET /api/auth/token` | Login challenge |
| Auth | `POST /api/auth/token` | Local login (passphrase), scoped token |
| Auth | `POST /api/auth/ext/request` | Build an authorization request for paired mobile apps |
| Auth | `POST /api/auth/ext/token` | Redeem a mobile app's approval for a token |
| System | `GET /api/system/status` | Liveness, initialisation state, clock state, self-test fault state |
| System | `GET /api/system/version` | Hardware and firmware identity |
| System | `GET /api/system/checkin` | Check-in step 1 (device-signed token) |
| System | `POST /api/system/checkin` | Check-in step 2 (apply backend reply; sets the device clock) |
| Key management | `POST /api/keymgmt/create` | Generate a key on the device |
| Key management | `GET /api/keymgmt/get/{kid}` | Read a key's type, public material and description |
| Key management | `POST /api/keymgmt/search` | Find keys by description |
| Key management | `GET /api/keymgmt/list` | List keys, first page |
| Key management | `GET /api/keymgmt/list/{offset}` | List keys from an offset |
| Key management | `GET /api/keymgmt/list/{offset}/{count}` | List keys with offset and page size |
| Crypto | `POST /api/crypto/hmac/hash` | HMAC with a stored key (derived data keys) |
| Crypto | `POST /api/crypto/cipher/wrap` | AES key wrap (envelope data keys) |
| Crypto | `POST /api/crypto/cipher/unwrap` | AES key unwrap |

Milestone-specific requirements:

- **M1.1.** Local login works unattended: given the passphrase and a scope, the library performs the challenge and proof steps itself.
- **M1.2.** The mobile-approval flow is exposed as two steps (create request, redeem reply). Carrying the request to the mobile app and the reply back is done by the caller or by a pluggable component (see open question Q2).
- **M1.3.** Check-in is exposed as two steps. Relaying the device's token to the backend and the reply back is done by the caller or by a pluggable component (see open question Q3). The library documents that the backend reply can carry management actions when the device's trusted-backend option is on.
- **M1.4.** Key listing hides the three path variants behind one paged operation (page size is at most 15).
- **M1.5.** A single health operation gives the consumer what it needs for a circuit breaker: reachable, initialised, no latched self-test fault, clock set.

## 4. Milestone 2: daily usage and audit logs

**Goal.** The full set of operations used in day-to-day work with an initialised device: complete key lifecycle, every cryptographic operation, reading the configuration, and downloading audit logs.

**Complete when** a consumer can manage keys end to end, use every cryptographic operation in the reference, read the device configuration, and list and download audit-log files.

| Area | Operation | Purpose |
|---|---|---|
| Key management | `POST /api/keymgmt/update` | Change a key's label or description |
| Key management | `DELETE /api/keymgmt/delete/{kid}` | Delete a key |
| Key management | `POST /api/keymgmt/import` | Import an external public key |
| Key management | `POST /api/keymgmt/derive` | Derive a new key via ECDH + HKDF |
| Crypto | `POST /api/crypto/hmac/verify` | Verify an HMAC |
| Crypto | `POST /api/crypto/exdsa/sign` | ECDSA / EdDSA signature |
| Crypto | `POST /api/crypto/exdsa/verify` | Verify an ECDSA / EdDSA signature |
| Crypto | `POST /api/crypto/cipher/encrypt` | AES encrypt (ECB, CBC, GCM) |
| Crypto | `POST /api/crypto/cipher/decrypt` | AES decrypt |
| Crypto | `POST /api/crypto/ecdh` | ECDH shared secret |
| Crypto | `POST /api/crypto/pqc/mlkem/encaps` | ML-KEM encapsulation |
| Crypto | `POST /api/crypto/pqc/mlkem/decaps` | ML-KEM decapsulation |
| Crypto | `POST /api/crypto/pqc/mldsa/sign` | ML-DSA signature |
| Crypto | `POST /api/crypto/pqc/mldsa/verify` | Verify an ML-DSA signature |
| System | `GET /api/system/config` | Read device configuration and identity keys |
| Logger | `GET /api/logger/key` | Audit-log verification key and signed nonce |
| Logger | `GET /api/logger/list` | List audit-log file ids (MSC build only) |
| Logger | `GET /api/logger/list/{offset}` | List audit-log file ids from an offset (MSC build only) |
| Logger | `GET /api/logger/{file}` | Download one audit-log file (MSC build only) |

Milestone-specific requirements:

- **M2.1.** The cryptographic operations support all key modes in the reference: a stored key alone, or a key agreed by ECDH with a stored or supplied peer public key.
- **M2.2.** Verify operations return a clear valid / invalid result; an invalid signature or MAC is not reported as a device failure.
- **M2.3.** Audit logs are delivered as raw text exactly as the device returns them, together with the verification key material. Parsing log lines and verifying the log's integrity chain are left to the caller.
- **M2.4.** Log listing hides the two path variants behind one paged operation.

## 5. Milestone 3: full specification, excluding diagnostic endpoints

**Goal.** Every remaining operation in the 1.2.2 reference: device provisioning, configuration changes, mobile-app pairing, attestation, firmware and dashboard upgrade, power control and storage control. After this milestone the library covers all 58 operations.

**Complete when** a consumer can take a factory-fresh device to a working state, administer it, pair a mobile app, upgrade it and control its storage slots, using only this library.

| Area | Operation | Purpose |
|---|---|---|
| Auth | `GET /api/auth/init` | Provisioning challenge (factory-fresh device) |
| Auth | `POST /api/auth/init` | Provision the device (one-shot) |
| Auth | `POST /api/auth/ext/init` | Mobile-app pairing step 1 |
| Auth | `POST /api/auth/ext/validate` | Mobile-app pairing step 2 |
| Auth | `POST /api/auth/ext/mac` | Proof that the device holds its identity key |
| System | `POST /api/system/config` | Change configuration; rotate the user key; import TLS material; generate a CSR; wipe the device |
| System | `GET /api/system/config/attestation` | Secure-element attestation material (MSC build only) |
| System | `POST /api/system/config/provisioning` | Write the attestation certificate (MSC build only) |
| System | `POST /api/system/upgrade/upload_fw` | Upload a firmware image (MSC build only) |
| System | `GET /api/system/upgrade/check_fw` | Verify the uploaded firmware (MSC build only) |
| System | `GET /api/system/upgrade/install_fw` | Install firmware and reboot (MSC build only) |
| System | `POST /api/system/upgrade/upload_ui` | Upload the dashboard archive (MSC build only) |
| System | `GET /api/system/upgrade/check_ui` | Verify the uploaded dashboard (MSC build only) |
| System | `GET /api/system/upgrade/install_ui` | Activate the dashboard (MSC build only) |
| System | `GET /api/system/upgrade/usbmode` | Reboot into USB mass-storage mode |
| System | `GET /api/system/selftest` | Run the full self-test suite |
| System | `GET /api/system/shutdown` | Shut the device down |
| System | `GET /api/system/reboot` | Reboot the device |
| Storage | `GET /api/storage/lock` | Hide a storage slot from the USB host (MSC build only) |
| Storage | `GET /api/storage/unlock` | Expose a storage slot (MSC build only) |
| Storage | `GET /api/storage/unlock/rw` | Expose a storage slot read-write (MSC build only) |
| Storage | `GET /api/storage/unlock/ro` | Expose a storage slot read-only (MSC build only) |

Milestone-specific requirements:

- **M3.1.** Operations that are unauthenticated on a factory-fresh device and authenticated afterwards work in both states.
- **M3.2.** Destructive or irreversible operations (wipe, provisioning, attestation-certificate write, firmware install, shutdown) cannot be triggered by accident: each needs an explicit, separately named call.
- **M3.3.** Operations after which the device closes the connection and restarts (install, reboot, shutdown, wipe) report success without treating the dropped connection as an error.
- **M3.4.** The asynchronous verify steps (firmware and dashboard check) are exposed as a start-and-poll operation with a clear final result.
- **M3.5.** Firmware and dashboard uploads accept large binary bodies (up to the device limit) without loading constraints beyond what the platform imposes.
- **M3.6.** Storage operations take the slot and access mode from the caller and obtain the matching token scope themselves, since the device reads both from the token.

## 6. Open questions and external dependencies

The REST reference does not define the following, and the library depends on each. They need an answer from vendor documentation or the vendor before the affected milestone is built.

| # | Question | Affects |
|---|---|---|
| Q1 | How the login secret is derived from the passphrase, and how the session key for the login proof is built from the challenge. | MVP |
| Q2 | How a mobile-approval request reaches the paired app and how the app's reply returns to the client. | MVP |
| Q3 | Which backend service check-in talks to, and its interface. | MVP |
| Q4 | How the device's TLS certificate is to be trusted (public certificate for the default hostname, or a private certificate the caller must pin). | MVP |
| Q5 | Device throughput and limits on concurrent connections and tokens. | MVP |
| Q6 | Browser use depends on the device's CORS allow-list being configured for the calling origin. Is that the caller's responsibility to document, or the library's? | MVP |
| Q7 | Which endpoints diagnostic firmware adds, so the exclusion can be stated precisely. | Milestone 3 |
