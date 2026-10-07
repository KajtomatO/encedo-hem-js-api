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
  const swept = await sweepTestKeys(deviceClient());
  process.stderr.write(swept.length === 0 ? '[sweep] no leftover EHEMTEST keys on the device\n' : `[sweep] deleted ${swept.length} leftover EHEMTEST key(s): ${swept.join(', ')}\n`);
}
