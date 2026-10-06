---
id: STEP-M1B-020
title: Integration and attended test harness
milestone: M1B
implements: ["REQ-TEST-003", "REQ-TEST-004", "REQ-TEST-005", "REQ-TEST-006"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#9-directory-layout"]
depends_on: ["STEP-M1B-010"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `npm run test:integration` runs `tests/integration/**` against the
device named by `EHEM_TEST_URL` and reports everything skipped without it;
`tests/attended/**` additionally needs `EHEM_ALLOW_DISRUPTIVE=1` and is run by
file; shared helpers build the device client from the environment and manage
`EHEMTEST` keys with cleanup. No device is contacted in this step.

**Notes:**
- Vitest project `integration`: Node only, `tests/integration/**/*.test.ts`,
  without `tests/support/setup.ts` (its network guard blocks `fetch`); its
  own setup reads the environment. `npm test`, `npm run check` and CI do not
  include it (REQ-TEST-003; `.github/workflows/ci.yml` unchanged).
- Environment, shared with [C-SDK] so one `hem.env` serves both projects:
  `EHEM_TEST_URL`, `EHEM_TEST_PASSPHRASE`, `EHEM_TEST_INSECURE=1` or
  `EHEM_TEST_CACERT=<file>`, `EHEM_TEST_PACE_MS` (default 150 for the
  integration command), `EHEM_ALLOW_DISRUPTIVE=1`. `hem.env` is git-ignored.
  Only `tests/support/` reads the environment; the library never does (D12).
- TLS flags become an `undici` `Agent` (`connect.rejectUnauthorized: false`
  or `connect.ca`) passed as the client's `fetch`, exactly as README
  "Trusting the device's TLS certificate" shows. `undici` is a
  devDependency; REQ-BUILD-002 (zero runtime dependencies) still holds.
- Project `attended`: `tests/attended/**/*.test.ts`, skipped unless both
  variables are set, excluded from `test:integration`; each test prints what
  it is about to do to the device before doing it (REQ-TEST-004). No script,
  hook or workflow sets the variable.
- Key helper (REQ-TEST-006): labels `EHEMTEST-<time>-<n>`, tracked kids
  deleted in teardown even after a failed body, start-of-run sweep of stray
  `EHEMTEST*` keys by listing all keys. The sweep filters by prefix only, so
  the protected set of REQ-TEST-005 is out of reach by construction.
- One smoke test (`system.status()`) proves the wiring. It is also the first
  live call, which belongs to STEP-M1B-030 — here it is only shown to skip.

**Definition of done**
- [ ] `npm run test:integration` exists; with `EHEM_TEST_URL` unset every
      integration test is reported skipped and the command exits 0.
- [ ] `npm test`, `npm run check` and CI run no file under
      `tests/integration/` or `tests/attended/`.
- [ ] Attended tests skip unless both `EHEM_TEST_URL` and
      `EHEM_ALLOW_DISRUPTIVE=1` are set, print their intended action first,
      and nothing in the repository sets the variable (grep).
- [ ] The device-client helper builds `HemClient` from the environment in
      `tests/support/` only; the existing source checks still show the
      library reading no environment variable.
- [ ] `EHEM_TEST_INSECURE=1` and `EHEM_TEST_CACERT` are honoured through an
      `undici` Agent; `undici` is a devDependency and the package test still
      shows zero runtime dependencies.
- [ ] Key helper: unique `EHEMTEST-<time>-<n>` labels, tracked kids deleted
      in teardown also after a failed body, start-of-run sweep by prefix —
      unit-tested with the fake fetch; grep shows no literal non-`EHEMTEST`
      label under `tests/integration/` or `tests/attended/`.
- [ ] README "Development" documents the integration and attended commands
      and the variables.
- [ ] `implements:` tags (in `tests/support/`, `vitest.config.ts`,
      `package.json`) and `verifies:` tags exist for REQ-TEST-003…006; the
      non-`(M1B)`, non-review boxes they close are ticked.
