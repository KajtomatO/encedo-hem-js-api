---
id: REQ-SYS-016
title: Device wipe
status: draft
priority: must
revision: 1
source: start_point §5; start_point M3.2; start_point M3.3; ref/api/hem-api-1.2.2.yaml
depends_on: ["REQ-API-012", "REQ-API-013"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings"]
---

# Device wipe

The library SHALL provide a dedicated call that wipes the device through
`POST /api/system/config`.

**Rationale:** A wipe erases keys and configuration and cannot be undone. On
the wire it is the field `wipeout` of the configuration write [YAML]; in the
library it is a call of its own (REQ-API-012). Introduced in M3.

**Acceptance criteria:**
- [ ] The call sends `{wipeout: true}` and nothing else.
- [ ] A dropped connection after the request is handled per REQ-API-013.
- [ ] After the call the session's credential and token cache are empty.
- [ ] A 406 (wipe refused) raises `HemOperationFailedError`.
- [ ] (M3B) attended and destructive: exercised only if the user chooses to,
      on a device the user names.
