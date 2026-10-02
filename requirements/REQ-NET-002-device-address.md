---
id: REQ-NET-002
title: Configurable device address
status: draft
priority: must
revision: 1
source: start_point G5; ref/api/hem-api-1.2.2.yaml
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#7-transport"]
---

# Configurable device address

The client SHALL accept the device address as a URL whose host is a hostname
or an IP address.

**Rationale:** The device may sit on a USB virtual network link, where the
reference lists `my.ence.do` and `192.168.7.1` [YAML], or be reachable
across a network under another name. Introduced in M1.

**Acceptance criteria:**
- [ ] Requests for `https://my.ence.do`, `https://192.168.7.1`,
      `http://192.168.7.1`, a URL with a port and an IPv6 literal all go to
      `<origin>/api/…`.
- [ ] A trailing slash on the URL makes no difference.
- [ ] A path prefix on the URL is kept in front of `/api/…`.
- [ ] A URL carrying a username or password is rejected with
      `HemValidationError`.
- [ ] (M1B) the device is reached by hostname and by IP address.
