// Runs the fixture tests below with the real test setup, to prove that the
// network guard fails a test. Used by tests/unit/network-guard.node.test.ts.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  test: {
    include: ['*.fixture.ts'],
    setupFiles: [fileURLToPath(new URL('../../support/setup.ts', import.meta.url)), fileURLToPath(new URL('../../support/setup.node.ts', import.meta.url))],
  },
});
