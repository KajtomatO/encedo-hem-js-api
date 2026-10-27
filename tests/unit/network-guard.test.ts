import { describe, expect, it } from 'vitest';
import { blockedFetch, takeNetworkViolations } from '../support/setup.js';

describe('network guard', () => {
  // verifies: REQ-TEST-001
  it('replaces the global fetch with one that rejects and records the request', async () => {
    expect(globalThis.fetch).toBe(blockedFetch);
    await expect(globalThis.fetch('https://hem.test/api/system/status')).rejects.toThrow(
      /unsubstituted fetch of GET https:\/\/hem\.test\/api\/system\/status/,
    );
    // Taken here so that this test itself does not fail in afterEach.
    expect(takeNetworkViolations()).toEqual(['GET https://hem.test/api/system/status']);
  });
});
