---
id: STEP-M1A-070
title: HemClient shell, exports, API snapshot and operation-docs check
milestone: M1A
implements: ["REQ-API-001", "REQ-API-007", "REQ-API-008", "REQ-API-010"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#3-component-overview", "ARCHITECTURE.md#1-decisions-fixed"]
depends_on: ["STEP-M1A-050"]
evidence:
  commits: ["990ac49"]
  tests: ["verifies: REQ-API-001", "verifies: REQ-API-007", "verifies: REQ-API-008", "verifies: REQ-API-010"]
  notes: "npm run check: 195 tests passed in Node 24 and Chromium. Namespaces are exported as interfaces (AuthApi, SystemApi, KeysApi, CryptoApi) and implemented by internal classes, so no internal type reaches the public declarations. TSDoc convention: @scope <scope|none> and @milestone M<n> on every namespace member; the check parses dist/*.d.ts. Snapshot: tests/static/public-surface.txt, regenerated only with UPDATE_SURFACE=1. Separate request queues per client are asserted with real operations once system.status exists (STEP-M1A-110)."
reopened: []
cancelled: null
---

**Goal:** `new HemClient(options)` validates its options, builds its
transport, exposes the namespaces `auth`, `system`, `keys` and `crypto`
(empty for now) and performs no I/O; `src/index.ts` exports the client, the
option types, every error class and `HEM_API_VERSION = "1.2.2"`; a
committed public-surface snapshot test and an operation-documentation check
exist.

**Notes:** Options per ARCHITECTURE.md §4: `url` (required), `fetch`,
`timeoutMs`, `tokenLifetimeSeconds`, credentials, relays, pacing. The
credential and relay options are declared here with their types and
consumed by later steps. No module-level mutable state. The snapshot lists
exported names and signatures (for example generated from the `.d.ts`
output) and is committed; its test fails on a changed or removed entry and
passes on additions. The docs check scans every public operation for TSDoc
stating the scope (or none) and the milestone; every later binding step
must keep it green. `logger` and `storage` namespaces arrive in M2A and
M3A. The exact identifiers fixed here are frozen by the additive rule (D13).

**Definition of done**
- [x] Constructing with a valid URL and a fake `fetch` makes zero `fetch` calls
- [x] Two clients for different URLs share no tokens, credentials or request queues
- [x] A missing URL, or a scheme other than `http:` or `https:`, throws `HemValidationError`
- [x] No mutable module-level state: no exported function changes the behaviour of an already constructed client
- [x] `HEM_API_VERSION` equals `1.2.2` and is exported from the package root
- [x] The public-surface snapshot is committed; a test fails when an entry changes or disappears and passes when entries are only added
- [x] The automated check fails for any public operation whose documentation lacks the scope or the milestone, and the comments are present in the emitted `.d.ts`
