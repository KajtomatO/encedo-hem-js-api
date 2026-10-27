// Runs once per device-test run, before any test file: deletes the EHEMTEST keys
// an interrupted earlier run left behind. Does nothing without a configured device.
// implements: REQ-TEST-006 — the start-of-run sweep.
import { deviceClient, deviceEnv } from './device-env.js';
import { sweepTestKeys } from './test-keys.js';

export async function setup(): Promise<void> {
  if (deviceEnv === undefined) return;
  if (deviceEnv.passphrase === undefined) {
    process.stderr.write('[sweep] EHEM_TEST_PASSPHRASE is not set: leftover EHEMTEST keys are not swept\n');
    return;
  }
  const client = deviceClient();
  // Public call, no token: says whether the login below will have to repair the clock first.
  const status = await client.system.status();
  process.stderr.write(`[sweep] device up ${status.uptime} s, clock ${status.clockSet ? 'set' : 'NOT set (the login will run one check-in)'}\n`);
  const swept = await sweepTestKeys(client);
  process.stderr.write(swept.length === 0 ? '[sweep] no leftover EHEMTEST keys on the device\n' : `[sweep] deleted ${swept.length} leftover EHEMTEST key(s): ${swept.join(', ')}\n`);
}
