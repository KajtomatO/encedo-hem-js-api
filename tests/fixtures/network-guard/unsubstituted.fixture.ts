// Expected to FAIL: each test reaches the global fetch without substituting it.
import { expect, it } from 'vitest';

it('awaits an unsubstituted request', async () => {
  await fetch('https://hem.test/api/system/status');
});

it('swallows the rejection of an unsubstituted request', async () => {
  await fetch('https://hem.test/api/system/version').catch(() => undefined);
  expect(true).toBe(true);
});
