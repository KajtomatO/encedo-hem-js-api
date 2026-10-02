---
id: REQ-SYS-013
title: User passphrase change
status: draft
priority: must
revision: 1
source: start_point §5; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-SYS-008", "REQ-AUTH-003", "REQ-AUTH-011"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
---

# User passphrase change

The library SHALL provide a call that changes the user passphrase by
rotating the device's user key through `POST /api/system/config`.

The request carries `userkey`, `userkey_hmac` and `userkey_nonce` together
[YAML]. The new key is derived from the new passphrase as in REQ-AUTH-003;
the nonce is the one returned by the configuration read.

**Rationale:** The reference lists user-key rotation among the uses of this
endpoint. It says the three fields go together and that the nonce is echoed
from the configuration read, but not how `userkey_hmac` is computed; no
other §8 source says so either. Introduced in M3.

**Acceptance criteria:**
- [ ] The three fields are sent together and never individually.
- [ ] After success the session's credential is the new one and the token
      cache is empty.
- [ ] A 406 (wrong role) raises `HemOperationFailedError`.
- [ ] OPEN: how `userkey_hmac` is computed is not specified by any §8
      source. It has to be established from the vendor or by experiment on a
      device before this requirement can be implemented.
- [ ] (M3B) attended: the passphrase of the test device is changed and
      changed back.
