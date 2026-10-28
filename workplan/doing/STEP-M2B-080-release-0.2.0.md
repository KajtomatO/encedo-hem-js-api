---
id: STEP-M2B-080
title: Release 0.2.0
milestone: M2B
implements: ["REQ-BUILD-006", "REQ-BUILD-007"]
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#10-milestones"]
depends_on: ["STEP-M2B-075"]
evidence:
  commits: ["ac796c0"]
  tests: ["tests/unit/pack-install.node.test.ts", "tests/unit/package.node.test.ts", "tests/unit/release.node.test.ts"]
  notes: "2026-10-27: version 0.2.0; CHANGELOG 0.2.0 entry dated with the M2 operations and the device findings of STEP-M2B-010…075 (SECP mode default, no SECP derive, 32-byte ECDH secrets, AES IV/tag, ML-DSA 795, generation times, locked current log file, the device hang); README status for 0.2.0, M3 next; REQ-BUILD-006 rev 3. Full check: 99 files, 2107 tests; the pack-and-install test packed kajtomato-encedo-hem-sdk-0.2.0.tgz and imported it. Waiting for the user: trusted publisher on npmjs.com, then the v0.2.0 tag; the workflow result closes REQ-BUILD-007 and this step. 2026-10-28: the user merged development into main (e081bf0) and pushed v0.2.0; the workflow passed every check and signed the provenance, then npm publish → 403 OIDC permission denied for this action. Fix on our side: package.json now names the repository (repository.url must match the GitHub repository per the npm trusted-publishing docs), with a unit test. Left to the user: the trusted publisher must allow direct npm publish (post-2026-09-03 defaults allow only npm stage publish; recreate the connection if needed), then re-tag v0.2.0 on the merged fix and push the tag again. User decision 2026-10-28: the workflow stages instead (npm stage publish, draft GitHub Release) — §6.2 impact analysis approved, REQ-BUILD-007 rev 4 reworked inside this step (release.yml, release.node.test.ts, CHANGELOG bullet); STEP-M2A-080 not reopened."
reopened: []
cancelled: null
---

**Goal:** Version 0.2.0 is recorded in `package.json` and the changelog; the packed archive installs; the user pushes the tag and the release workflow publishes 0.2.0 and creates its GitHub Release.

**Notes:**
- `package.json` version 0.2.0; `CHANGELOG.md`: the Unreleased section
  becomes `## 0.2.0 — <date>` and gains the device findings callers must
  know from the M2B runs; README status line updated; the pack-and-install
  test and `npm run check` pass.
- Then the user's part, in this order: configure the trusted publisher on
  npmjs.com (owner `KajtomatO`, repository `encedo-hem-js-api`, workflow
  `release.yml`) if not yet done; merge or push `development` as they see
  fit; push the tag `v0.2.0`. The workflow's first live run stages 0.2.0
  and creates the draft release; the user approves the staged package on
  npmjs.com and publishes the draft (REQ-BUILD-007 `(M2B)` box). The step
  records the outcome the user reports (or the workflow log) in its
  evidence.
- Never push (CLAUDE.md).

**Definition of done**
- [x] `package.json` is 0.2.0; the changelog entry is dated and lists the
      M2 operations and device findings; README status updated.
- [x] Pack-and-install test and `npm run check` pass.
- [ ] REQ-BUILD-006: the 0.2.0 criterion noted; REQ-BUILD-007 `(M2B)` box
      ticked with the workflow's result, or the failure recorded and a
      fix step proposed.
