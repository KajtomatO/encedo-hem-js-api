---
id: REQ-BUILD-007
title: Releases are published from CI on a version tag
status: needs-reverify
priority: must
revision: 4
source: user decision 2026-10-27; approved 2026-10-27
depends_on: ["REQ-BUILD-005", "REQ-BUILD-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#8-testing-policy"]
---

# Releases are published from CI on a version tag

A workflow under `.github/workflows/` SHALL stage the package on npm
(`npm stage publish`) and create a draft GitHub Release when a tag `v*`
whose name matches the `package.json` version is pushed. The version
becomes public when the user approves the staged package on npmjs.com (or
with `npm stage approve`) and publishes the draft release.

**Rationale:** Pushing the tag stays the user's decision, as it was for
0.1.0 (REQ-BUILD-006). The publish itself then runs from a clean checkout
after the A-gate checks, so no stale build output or uncommitted change can
reach the registry. npm trusted publishing (OIDC) is used instead of a
long-lived npm token (docs.npmjs.com, "Trusted publishers"). The workflow
stages rather than publishes (user decision 2026-10-28, §6.2 impact
analysis at STEP-M2B-080; revision 4): a trusted publisher created after
2026-09-03 allows `npm stage publish` by default and direct `npm publish`
only as an opt-in, and a staged version goes live only after a maintainer
approves it with 2FA — which an OIDC token cannot do (docs.npmjs.com,
"Staged publishing" and "npm stage": npm CLI 11.15.0 or later). The
GitHub Release is a draft for the same reason: a rejected staging leaves no
public release page. Provenance is expected for a public package staged
from a public repository; the staging documentation does not state it, so
the first run records it. 0.1.0 was published by hand on 2026-10-27 because
a trusted publisher is configured on a package that already exists on the
registry. Introduced after M1B; implemented in M2A, first exercised at the
0.2.0 release (M2B).

**Acceptance criteria:**
- [x] `.github/workflows/release.yml` runs on `push` of tags `v*` only, plus
      a manual `workflow_dispatch` dry run (`npm stage publish --dry-run`)
      that stages nothing — STEP-M2A-080 (2026-10-27), reworked
      STEP-M2B-080 (2026-10-28); a manual run needs no input, it is always
      a dry run.
- [x] Before any publish step the job runs the same install, Playwright
      install and `npm run check` steps as `ci.yml` — the test compares the
      first three run steps with `ci.yml`.
- [x] The job fails if the tag name is not `v` followed by the
      `package.json` version.
- [x] `npm stage publish` runs with `permissions: id-token: write` and the
      workflow holds no npm token (`NODE_AUTH_TOKEN`, `NPM_TOKEN` or any
      other registry secret) — a step also fails the job if the runner's
      npm is older than 11.15.0, the first version with `npm stage`
      (Node 24 bundles 11.19.1; STEP-M2B-080, 2026-10-28).
- [x] A draft GitHub Release named after the tag is created with the
      matching `CHANGELOG.md` section as its notes, using the workflow's own
      `GITHUB_TOKEN` (`contents: write`); the user publishes it when
      approving the npm release — the section is cut by an awk program that
      the unit test runs against the 0.1.0 entry; `--draft` since
      STEP-M2B-080 (2026-10-28).
- [x] The workflow holds no device credentials and runs no integration or
      attended test (as REQ-BUILD-005).
- [x] A unit test in the style of `tests/unit/ci.node.test.ts` checks the
      workflow file for the criteria above — `tests/unit/release.node.test.ts`.
- [ ] (user) The trusted publisher for `@kajtomato/encedo-hem-sdk` is
      configured on npmjs.com: GitHub Actions, owner `KajtomatO`, repository
      `encedo-hem-js-api`, workflow filename `release.yml`. `npm stage
      publish` is always allowed for a trusted publisher, so no option is
      needed. Open: whether a staged publish counts as the first successful
      publish that validates a new trusted publisher within two days
      (docs.npmjs.com, "Trusted publishers") — recorded at the first run.
- [ ] (M2B) Pushing the 0.2.0 tag stages 0.2.0 on npm and creates its draft
      GitHub Release; after the user's approval `npm view` shows 0.2.0 —
      the first live run of the workflow. First attempt
      2026-10-28 (tag `v0.2.0` on `main`): checks passed, the provenance
      statement was signed and logged, then `npm publish` was refused with
      `403 OIDC permission denied for this action`. Two documented causes
      (docs.npmjs.com, "Trusted publishing for npm packages", read
      2026-10-28): `package.json` had no `repository.url`, which must match
      the GitHub repository exactly — added (STEP-M2B-080); and a trusted
      publisher created after 2026-09-03 allows only `npm stage publish`
      unless direct `npm publish` was chosen at creation, and a connection
      cannot be edited, only replaced — the user chose staged publishing
      instead (2026-10-28).
