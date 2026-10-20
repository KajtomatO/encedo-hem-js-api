// Live: the device policy after a run — no EHEMTEST key remains and the protected
// set (TLS material, paired phones) is present and untouched. Run last, on its own,
// as the B-gate check; its listing goes to the run log (prefix `[policy]`).
import { expect, it } from 'vitest';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { isTestKey } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[policy] ${label}: ${JSON.stringify(value)}\n`);
}

/** Whether a key belongs to the protected set of REQ-TEST-005. */
function isProtected(label: string): boolean {
  return label === 'TLS PrivateKey' || label === 'TLS Certificate' || label.includes('(Android)') || label.includes('(iPhone)');
}

describeDevice('device policy after the run', () => {
  // verifies: REQ-TEST-005, REQ-TEST-006
  it('lists no EHEMTEST key, and the protected set is present', async () => {
    const all = await deviceClient().keys.listAll();
    const test = all.filter(isTestKey);
    const protectedKeys = all.filter((key) => isProtected(key.label)).map((key) => ({ kid: key.kid, type: key.type.raw, label: key.label }));
    const others = all.filter((key) => !isTestKey(key) && !isProtected(key.label)).map((key) => key.label);
    log('repository', { total: all.length, test: test.length, protected: protectedKeys, otherLabels: others });
    expect(test).toHaveLength(0);
    expect(protectedKeys.map((key) => key.label)).toEqual(expect.arrayContaining(['TLS PrivateKey', 'TLS Certificate']));
  });
});
