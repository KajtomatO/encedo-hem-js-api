// Device tests. They are never part of `npm test`, `npm run check` or CI: this is a
// separate configuration, reached only through `npm run test:integration` and
// `npm run test:attended`, and every test in it skips without EHEM_TEST_URL.
// implements: REQ-TEST-003 — separate command and configuration; the skip itself is in tests/support/integration-env.ts.
// implements: REQ-TEST-004 — attended tests are their own project, started by file, behind EHEM_ALLOW_DISRUPTIVE=1.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // One device: test files run one after another, never side by side.
    fileParallelism: false,
    // A project with no files yet (attended, before its first test) is not a failure.
    passWithNoTests: true,
    // Not tests/support/setup.ts — that one blocks the network.
    setupFiles: ['tests/support/integration-setup.ts'],
    // Once per run: sweep EHEMTEST keys left by an interrupted earlier run.
    globalSetup: ['tests/support/integration-global-setup.ts'],
    projects: [
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['tests/integration/**/*.test.ts'],
          // Login runs 600 000 PBKDF2 iterations and the device delays login replies.
          testTimeout: 120_000,
          hookTimeout: 120_000,
        },
      },
      {
        extends: true,
        test: {
          name: 'attended',
          environment: 'node',
          include: ['tests/attended/**/*.test.ts'],
          // A person acts between steps; the limit only catches a forgotten test.
          testTimeout: 3_600_000,
          hookTimeout: 3_600_000,
        },
      },
    ],
  },
});
