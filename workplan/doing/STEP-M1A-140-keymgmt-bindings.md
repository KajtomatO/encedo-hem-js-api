---
id: STEP-M1A-140
title: Key-management bindings — create, get, search, list, type parsing
milestone: M1A
implements: ["REQ-KEY-001", "REQ-KEY-002", "REQ-KEY-003", "REQ-KEY-004", "REQ-KEY-005", "REQ-API-005"]
traces:
  architecture: ["ARCHITECTURE.md#6-protocol-bindings", "ARCHITECTURE.md#11-risks--open-questions"]
depends_on: ["STEP-M1A-060", "STEP-M1A-100"]
evidence:
  commits: []
  tests: []
  notes: null
reopened: []
cancelled: null
---

**Goal:** `client.keys.create`, `get`, `search` and `list`, an iteration
helper over all pages, an exact-match helper over search, and the key-type
parser, each validated before sending, scoped per ARCHITECTURE.md §6,
refused over `http:`, and tested for request shape and response mapping.

**Notes:** Create: body `{label, type}` plus `mode` and `descr` (base64)
when given; scope `keymgmt:gen`; the type list and the three mode literals
are checked before sending; the TSDoc states the default mode of `SECP*`
keys (quirk 11). Get: scope `keymgmt:use:<kid>`; `updated` required;
`type`, `pubkey`, `der`, `descr` when present; 406 is
`HemOperationFailedError`; the TSDoc states the public-key formats and that
label and description come from list or search (quirk 7). Search: body
`{descr}` with `^` or `$` marker plus `offset` and `limit`; scope
`keymgmt:search`; needle at most 64 bytes, limit at most 15; the device's
200 with an empty list and older firmware's 404 both give an empty result
(quirk 8). List: one operation over the three paths; scope `keymgmt:list`;
count 1 to 15, offset a non-negative integer; a page has `offset`, `total`,
`listed` and keys with `kid`, `type`, `label`, `created`, `updated`,
`descr`; iteration stops at `total` or an empty page, never on a short
page. Type parser: flags `ATT`, `PKEY`, `ECDH`, `ExDSA`, `CERT`, `PQC` plus
every algorithm name; a bare name parses to the algorithm with no flags; an
unknown token is kept, not an error. Every operation sets `requiresTls`.
This is the largest step; if it runs long, split off create and search as
STEP-M1A-145.

**Definition of done**
- [ ] Create: request shape, scope `keymgmt:gen`, result is the key id; a type outside the list or a mode outside the three literals raises `HemValidationError`; label and description limits are enforced; the documentation states the default mode of `SECP*` keys
- [ ] Get: scope `keymgmt:use:<kid>` in lower case; `updated` required, `type`, `pubkey`, `der`, `descr` when present; 406 raises `HemOperationFailedError`; the documentation states the public-key formats and where label and description come from
- [ ] Search: body with markers and paging; scope `keymgmt:search`; a needle over 64 bytes or a limit over 15 raises `HemValidationError`; an empty list and a 404 both yield an empty result; the exact-match helper works by prefix search and comparison
- [ ] List: any offset and any count from 1 to 15 build a valid request; a count over 15 or a negative or non-integer offset raises `HemValidationError`; page fields as specified; the iteration helper stops only at `total` or an empty page
- [ ] Type parser: all flags and algorithm names recognised; a bare name parses with no flags; an unknown token raises no error and the original string stays available
- [ ] Every operation on an `http:` client raises `HemTlsRequiredError` with zero `fetch` calls
- [ ] An upper-case key id is accepted and sent in lower case; each operation is documented with its scope and milestone M1
