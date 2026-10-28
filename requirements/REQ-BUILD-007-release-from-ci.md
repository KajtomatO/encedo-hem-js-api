---
id: REQ-BUILD-007
title: Releases are published from CI on a version tag
status: verified
priority: must
revision: 3
source: user decision 2026-10-27; approved 2026-10-27
depends_on: ["REQ-BUILD-005", "REQ-BUILD-006"]
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#4-public-api--conventions", "ARCHITECTURE.md#8-testing-policy"]
---

# Releases are published from CI on a version tag

A workflow under `.github/workflows/` SHALL publish the package to npm and
create a GitHub Release when a tag `v*` whose name matches the `package.json`
version is pushed.

**Rationale:** Pushing the tag stays the user's decision, as it was for
0.1.0 (REQ-BUILD-006). The publish itself then runs from a clean checkout
after the A-gate checks, so no stale build output or uncommitted change can
reach the registry. npm trusted publishing (OIDC) is used instead of a
long-lived npm token, and it attaches provenance to the package without
further setup (docs.npmjs.com, "Trusted publishers": npm CLI 11.5.1 or
later; provenance is generated automatically for a public package published
from a public repository). 0.1.0 was published by hand on 2026-10-27 because
a trusted publisher is configured on a package that already exists on the
registry. Introduced after M1B; implemented in M2A, first exercised at the
0.2.0 release (M2B).

**Acceptance criteria:**
- [x] `.github/workflows/release.yml` runs on `push` of tags `v*` only, plus
      a manual `workflow_dispatch` dry run that stops before publishing —
      STEP-M2A-080 (2026-10-27); a manual run needs no input, it is always
      a dry run.
- [x] Before any publish step the job runs the same install, Playwright
      install and `npm run check` steps as `ci.yml` — the test compares the
      first three run steps with `ci.yml`.
- [x] The job fails if the tag name is not `v` followed by the
      `package.json` version.
- [x] `npm publish` runs with `permissions: id-token: write` and the workflow
      holds no npm token (`NODE_AUTH_TOKEN`, `NPM_TOKEN` or any other
      registry secret) — a step also fails the job if the runner's npm is
      older than 11.5.1.
- [x] A GitHub Release named after the tag is created with the matching
      `CHANGELOG.md` section as its notes, using the workflow's own
      `GITHUB_TOKEN` (`contents: write`) — the section is cut by an awk
      program that the unit test runs against the 0.1.0 entry.
- [x] The workflow holds no device credentials and runs no integration or
      attended test (as REQ-BUILD-005).
- [x] A unit test in the style of `tests/unit/ci.node.test.ts` checks the
      workflow file for the criteria above — `tests/unit/release.node.test.ts`.
- [ ] (user) The trusted publisher for `@kajtomato/encedo-hem-sdk` is
      configured on npmjs.com: GitHub Actions, owner `KajtomatO`, repository
      `encedo-hem-js-api`, workflow filename `release.yml`.
- [ ] (M2B) Pushing the 0.2.0 tag publishes 0.2.0 to npm and creates its
      GitHub Release — the first live run of the workflow. First attempt
      2026-10-28 (tag `v0.2.0` on `main`): checks passed, the provenance
      statement was signed and logged, then `npm publish` was refused with
      `403 OIDC permission denied for this action`. Two documented causes
      (docs.npmjs.com, "Trusted publishing for npm packages", read
      2026-10-28): `package.json` had no `repository.url`, which must match
      the GitHub repository exactly — added (STEP-M2B-080); and a trusted
      publisher created after 2026-09-03 allows only `npm stage publish`
      unless direct `npm publish` was chosen at creation, and a connection
      cannot be edited, only replaced — the user's to check.
