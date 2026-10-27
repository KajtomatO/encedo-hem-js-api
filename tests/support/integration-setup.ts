// Setup of the device-test projects. Deliberately not the unit setup: these tests
// are meant to reach the device, so the global `fetch` stays real (the cloud
// relays use it). Says once why nothing runs when the device is not configured.
// supports: REQ-TEST-003
const noted = Symbol.for('encedo-hem-js-api.device-tests-note');
const state = globalThis as { [noted]?: true };

if (process.env['EHEM_TEST_URL'] === undefined || process.env['EHEM_TEST_URL'] === '') {
  if (!state[noted]) {
    state[noted] = true;
    process.stderr.write('EHEM_TEST_URL is not set: device tests are skipped (set it to the HEM device URL to run them)\n');
  }
}
