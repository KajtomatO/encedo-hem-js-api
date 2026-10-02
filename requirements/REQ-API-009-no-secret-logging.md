---
id: REQ-API-009
title: Secrets never logged, stored or put into error messages
status: draft
priority: must
revision: 1
source: start_point G13; ARCHITECTURE.md §1
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#52-session-behaviour"]
---

# Secrets never logged, stored or put into error messages

The library SHALL NOT write passphrases, derived keys, shared secrets or
bearer tokens to any log, console, storage or error message.

**Rationale:** The library handles the credential that unlocks an HSM.
Anything it leaks into logs or error reports ends up in places with weaker
protection than the process memory. Introduced in M1.

**Acceptance criteria:**
- [ ] A static check shows `src/` contains no console output and no use of
      persistent storage (web storage, IndexedDB, files, environment
      variables).
- [ ] A unit test inspects the error of a failed login — message, properties
      and JSON form — and finds neither the passphrase, the eJWT nor a
      token.
- [ ] A unit test does the same for a failed authenticated call and finds no
      token.
