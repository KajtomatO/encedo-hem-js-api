---
id: STEP-M2A-080
title: Release workflow: publish from CI on a version tag
milestone: M2A
implements: ["REQ-BUILD-007"]
traces:
  architecture: ["ARCHITECTURE.md#8-testing-policy", "ARCHITECTURE.md#4-public-api--conventions"]
depends_on: []
evidence:
  commits: ["48d190d"]
  tests: ["verifies: REQ-BUILD-007 (tests/unit/release.node.test.ts)"]
  notes: "npm run check on 2026-10-27: 99 files, 2105 tests passed in Node v24.21.0 and headless Chromium. The workflow has not run on GitHub (nothing is pushed from here); its first live run is the 0.2.0 tag (REQ-BUILD-007 (M2B) box). Design: push of v* tags or a manual dispatch; checkout, setup-node 24 with registry-url, npm ci, Playwright, npm run check, an npm >= 11.5.1 guard, tag == v<version> check, npm publish (OIDC, pushed tag only; a manual run does npm publish --dry-run), gh release create with the CHANGELOG section cut by awk. The unit test runs that awk program against CHANGELOG.md and checks it yields exactly the 0.1.0 entry and nothing for an unknown version. Still the user's: configure the trusted publisher on npmjs.com (owner KajtomatO, repository encedo-hem-js-api, workflow filename release.yml) before the 0.2.0 tag."
reopened: []
cancelled: null
---

**Goal:** `.github/workflows/release.yml` publishes the package to npm through trusted publishing and creates a GitHub Release when a `v*` tag matching the package version is pushed; a unit test checks the workflow file.

**Notes:**
- **Precondition:** REQ-BUILD-007 was `draft` at decomposition and was
  approved by the user later on 2026-10-27; the step can start.
- Trigger: `push` with `tags: ['v*']` only, plus `workflow_dispatch` with a
  boolean `dry_run` input that stops before publishing. Permissions:
  `contents: write`, `id-token: write`. Steps: checkout, setup-node 24 with
  npm cache, `npm ci`, Playwright install, `npm run check` (same as
  `ci.yml`), a tag-equals-version check (`v$(node -p
  "require('./package.json').version")` against `github.ref_name`),
  `npm publish` (OIDC; no `NODE_AUTH_TOKEN`), then a GitHub Release named
  after the tag with the matching `CHANGELOG.md` section as notes
  (`gh release create` with the workflow's `GITHUB_TOKEN`).
- Unit test `tests/unit/release.node.test.ts` in the style of
  `tests/unit/ci.node.test.ts`: trigger, order of steps, permissions, no
  token secret, no device credentials, no integration/attended run.
- Nothing here is pushed or run by Claude; the first live run is the
  0.2.0 tag (REQ-BUILD-007 `(M2B)` box). The user configures the trusted
  publisher on npmjs.com (`(user)` box).

**Definition of done**
- [x] `release.yml` exists with the trigger, permissions and step order
      above; no `secrets.`/`NODE_AUTH_TOKEN`/`HEM_` in it.
- [x] The tag/version check fails the job on a mismatch.
- [x] The GitHub Release step extracts the CHANGELOG section for the
      version.
- [x] `tests/unit/release.node.test.ts` verifies REQ-BUILD-007's testable
      criteria and passes; `implements:` tag in the workflow file.
- [x] The non-`(user)`, non-`(M2B)` boxes of REQ-BUILD-007 are ticked.
