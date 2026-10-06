// Unit tests run twice over the same files: in Node 24 and in headless Chromium.
// implements: REQ-TEST-002 — one command (`npm test`) runs both projects.
// implements: REQ-TEST-001 — every file loads tests/support/setup.ts, which blocks the network.
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

const unitTests = 'tests/unit/**/*.test.ts';
// Tests that need the filesystem, child processes or the build output.
const nodeOnlyTests = 'tests/unit/**/*.node.test.ts';

export default defineConfig({
  test: {
    setupFiles: ['tests/support/setup.ts'],
    // The login vector runs the full 600 000 PBKDF2 iterations, which takes seconds in the browser.
    testTimeout: 60_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: [unitTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'browser',
          include: [unitTests],
          exclude: [nodeOnlyTests],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
