---
id: REQ-API-001
title: Client object created from options, with no global state
status: verified
priority: must
revision: 1
source: ARCHITECTURE.md §4; start_point G5
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#3-component-overview"]
---

# Client object created from options, with no global state

The library SHALL provide a client object that is created from an options
object containing at least the device URL, performs no network or
cryptographic work during construction, and keeps all of its state inside
that object.

**Rationale:** One client stands for one device. A process can then talk to
several devices at once, and unit tests can build clients freely without
side effects. Introduced in M1.

**Acceptance criteria:**
- [ ] Constructing a client with a valid URL and a substituted `fetch` makes
      zero `fetch` calls.
- [ ] Two clients for different URLs used in the same test do not share
      tokens, credentials or request queues.
- [ ] Constructing without a URL, or with a URL whose scheme is neither
      `http:` nor `https:`, throws `HemValidationError`.
- [ ] The package has no mutable module-level state: no exported function
      changes the behaviour of an already constructed client.
