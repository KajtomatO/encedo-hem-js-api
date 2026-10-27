// The harness itself, seen from inside the integration project.
import { describe, expect, it } from 'vitest';
import { describeDevice, deviceClient } from '../support/integration-env.js';

describe('integration project', () => {
  // verifies: REQ-TEST-003 — this project runs without the unit network guard, so device calls can go out.
  it('runs with the real global fetch, not the unit-test guard', () => {
    expect(String(globalThis.fetch)).not.toContain('Unit tests must not use the network');
  });
});

// verifies: REQ-TEST-003 — skipped, not failed, without EHEM_TEST_URL.
describeDevice('device smoke test', () => {
  it('reaches the device named by EHEM_TEST_URL', async () => {
    const status = await deviceClient().system.status();
    expect(status.ctx).toBeTypeOf('number');
  });
});
