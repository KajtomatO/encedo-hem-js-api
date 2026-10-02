# CLAUDE.md

JavaScript/TypeScript client for the Encedo HEM REST API. Work is managed by an
AI-assisted requirements and workplan process.

- Before any requirement, step, or traceability work, read
  [REQUIREMENTS-MANAGEMENT.md](REQUIREMENTS-MANAGEMENT.md) (the process; its
  Appendix A lists the standing commands) and [ARCHITECTURE.md](ARCHITECTURE.md)
  (what is being built, milestones).
- Claude produces, humans decide: never approve, reject or supersede a REQ;
  propose milestone decompositions and impact analyses, then **stop** for approval.
- Steps move only by `git mv` between `workplan/todo|doing|done`; WIP limit 2;
  every commit subject during a step starts with `[STEP-<ID>]`.
- Tag code `// implements: REQ-…` and tests `// verifies: REQ-…`;
  `requirements/TRACE.md` is generated, never hand-edited.
- Claims about device or API behavior cite a §8 source (device, encedo-hem-c-api,
  `ref/api/hem-api-1.2.2.yaml`, encedo-hem-api-doc) — never memory. Unresolved
  questions stay as unchecked acceptance criteria.
- Never run disruptive tests (reboot, shutdown, wipe, firmware/UI upgrade,
  provisioning) automatically.
- `requirements/start_point/` is input material, not requirements.
