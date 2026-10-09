---
id: REQ-AUTH-005
title: Scope chosen and token attached by the library
status: verified
priority: must
revision: 6
source: start_point G9; start_point G10; ref/api/hem-api-1.2.2.yaml; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-004"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#6-protocol-bindings"]
---

# Scope chosen and token attached by the library

For each authenticated operation the library SHALL determine the required
scope itself and attach a token of exactly that scope, so that the caller
never supplies a scope or a token for it.

**Rationale:** The crypto endpoints compare the scope for an exact match
with `keymgmt:use:<kid>` [YAML]; a token with a broader scope is answered
with 403 [C-SDK]. Getting this right is mechanical and belongs in the
library. Introduced in M1.

**Acceptance criteria:**
- [x] A table-driven unit test over every authenticated operation shows the
      scope requested at login equals the one listed for it in
      ARCHITECTURE.md §6.
- [x] Crypto operations and key get request `keymgmt:use:<kid>` with the key
      id in lower-case hex.
- [x] The token is sent as `Authorization: Bearer <token>`.
- [x] No device operation has a parameter for passing a token.
- [x] (M1B) each M1 operation is accepted by the device with the scope the
      library chose, and one `keymgmt:use:<kid>` token serves both key get
      and a crypto operation on that key — 2026-10-09, all answered 200:
      create `keymgmt:gen`; get, wrap, unwrap, hmac `keymgmt:use:<kid>`;
      list `keymgmt:list`; search `keymgmt:search`; delete `keymgmt:del`;
      status, version, check-in without a token. `get` then `hmac` on one
      key needed exactly one login (tests/integration/crypto.test.ts).
