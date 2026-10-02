---
id: REQ-AUTH-006
title: Requested token lifetime
status: verified
priority: must
revision: 1
source: start_point G11; https://github.com/KajtomatO/encedo-hem-c-api
depends_on: ["REQ-AUTH-002"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#52-session-behaviour", "ARCHITECTURE.md#11-risks--open-questions"]
---

# Requested token lifetime

The token lifetime requested at login SHALL default to 8 hours and be
configurable by the caller.

The proof's `exp` claim is the local time plus the lifetime. It is not
limited by the challenge's own `exp`, which is only the deadline (device
time plus 60 seconds) for submitting the proof [C-SDK].

**Rationale:** The device copies the proof's `exp` into the token it issues
[C-SDK]. Limiting it to the challenge deadline, as an earlier reference
client did, yields 60-second tokens and a login before almost every call.
Introduced in M1.

**Acceptance criteria:**
- [ ] By default `exp − iat` in the proof is 28 800.
- [ ] A configured lifetime is used instead.
- [ ] With a challenge whose `exp` is 60 seconds ahead, the proof still
      carries the full lifetime.
- [ ] A lifetime that is zero, negative or not an integer raises
      `HemValidationError`.
- [ ] (M1B) the device issues a token of about 8 hours for the default.
- [ ] (M1B) a lifetime above 8 hours is probed and the device's reaction
      recorded (ARCHITECTURE.md §11, risk 8).
