---
id: REQ-BUILD-001
title: TypeScript source published as ESM with type declarations
status: draft
priority: must
revision: 1
source: start_point G1
depends_on: []
supersedes: null
superseded_by: null
traces:
  architecture: ["ARCHITECTURE.md#1-decisions-fixed", "ARCHITECTURE.md#9-directory-layout"]
---

# TypeScript source published as ESM with type declarations

The package SHALL be written in TypeScript and published as ECMAScript
modules with type declarations.

**Rationale:** ESM is the module format Node and browsers share. Type
declarations are what make the typed results and errors usable by a
consumer. Introduced in M1.

**Acceptance criteria:**
- [ ] The build command emits ESM `.js` files and `.d.ts` files.
- [ ] `package.json` declares `"type": "module"` and an `exports` map with
      types; there is no CommonJS output.
- [ ] Strict type-checking passes.
- [ ] A smoke test imports the built package from a plain ESM file in Node
      24.
- [ ] The packed archive contains only the build output, README, LICENSE and
      `package.json`.
