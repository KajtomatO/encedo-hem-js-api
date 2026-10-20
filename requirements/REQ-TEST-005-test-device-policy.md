---
id: REQ-TEST-005
title: The test device and what tests may do to it
status: verified
priority: must
revision: 4
source: user decision 2026-10-06 (M1B decomposition); ARCHITECTURE.md §1 D10, §8; https://github.com/KajtomatO/encedo-hem-c-api (device record and test policy)
depends_on: ["REQ-TEST-003", "REQ-TEST-004"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#1-decisions-fixed"]
---

# The test device and what tests may do to it

Device tests SHALL run only against the development HEM described here and
do nothing to it beyond the actions this requirement permits.

**The device** ([C-SDK]; re-recorded live at M1B): the development HEM at
`https://my.ence.do`, also reachable by its IP address; firmware 1.2.2
diagnostic build (`-DIAG`); mass-storage hardware; initialised with Encedo
Manager — PBKDF2 login confirmed 2026-10-06; wiped and re-initialised
2026-07-22. One user passphrase is available, no master passphrase. One
phone running the Encedo app is paired. Known behaviour: the clock runs
about 8 % fast and is unset after a cold boot; the device stalls under
sustained load and then needs a power cycle; its TLS certificate is
renewed outside this library.

**Protected set**, never modified or deleted: keys labelled exactly
`TLS PrivateKey` or `TLS Certificate`, and keys whose label contains
`(Android)` or `(iPhone)` — the device's TLS material and paired phones.

**Permitted unattended** (integration tests): every M1 read and crypto
operation; check-in against the real Encedo backend; creating and deleting
keys under REQ-TEST-006.

**Permitted only with the user present** (attended tests): mobile approval
(pushes to the paired phone); unplugging or power-cycling the device; a
soft reboot the user triggers outside this library; the parallel-request
probe.

**Not permitted in M1B**: wipe, provisioning, firmware or dashboard
upgrade, shutdown, configuration writes, any change to the protected set.

**Rationale:** D10 defers this choice to just before M1B. The device is the
one the C client verified against, so its record and the
disposable-except-protected policy carry over, and both projects share one
`hem.env`. Introduced in M1B.

**Acceptance criteria:**
- [x] (M1B) the live `version` and `status` responses are recorded here and
      match the description above — 2026-10-07: hardware "PPA rev 2.2",
      firmware "Encedo nGINE FW v1.2.2-DIAG", bootloader "Encedo Secure
      Bootloader v2.0.1"; `status` reports `storage` (two slots: 8388607
      sectors read-only, 234364924 unassigned), so mass-storage hardware;
      reached as `my.ence.do` and `192.168.7.1`; the clock was unset after
      the day's power cycle and set again by the first login's automatic
      check-in. Full records in REQ-SYS-001 and REQ-SYS-002.
- [x] Integration tests use only operations permitted unattended; every
      other device test lives under `tests/attended/` (REQ-TEST-004) —
      reviewed at the gate, 2026-10-20: the integration files call status,
      version, health, check-in, list, get, search, create, delete, HMAC,
      wrap and unwrap only; pushes, power cycling and the parallel probe are
      under `tests/attended/`.
- [x] No test sends a request that modifies a key of the protected set
      (review criterion at the B gate) — reviewed 2026-10-20: every delete
      goes through the `TestKeys` helper (keys it created), the `EHEMTEST`
      sweep, or a random absent kid in the error tests; crypto operations
      use keys the helper created.
- [x] (M1B) after the full M1B run the protected set is unchanged —
      2026-10-20 [device], after the gate run (`device-policy` integration
      test): 5 keys in all; protected: `TLS PrivateKey` (PKEY,GENERIC_DER),
      `TLS Certificate` (CERT,GENERIC_DER), one paired phone
      `… (Android)` (ECDH,CURVE25519); two other user keys; no `EHEMTEST`
      key. The same three protected keys were present at the first M1B
      listing (STEP-M1B-060).

**Configuration observed (2026-10-12, read-only `system:config`):**
`origin` `*`, `trusted_backend` true, `allow_keysearch` true, hostname
`my.ence.do`. With `trusted_backend` on, a check-in reply may carry a
management action (lock, wipe, soft-brick, forced upgrade); every reply in
M1B was `OK`.
