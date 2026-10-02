---
id: REQ-API-012
title: Destructive actions reachable only through dedicated calls
status: draft
priority: must
revision: 1
source: start_point M3.2; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions"]
---

# Destructive actions reachable only through dedicated calls

Wipe, provisioning, attestation-certificate write, firmware install and
shutdown SHALL each be reachable only through a call dedicated to that one
action.

**Rationale:** On the wire, a wipe is just one more field of the
configuration write [YAML]. If the library mirrored that, a stray option
could erase a device. A separately named call makes the intent visible in
code review. Introduced in M3.

**Acceptance criteria:**
- [ ] The general configuration-write call has no way to send `wipeout`: the
      field is absent from its input type, and an untyped object carrying it
      is rejected with `HemValidationError`.
- [ ] Each of the five actions is its own named method.
- [ ] No other method has an option that turns it into one of these actions.
