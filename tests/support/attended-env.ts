// Attended tests need a person at the device or the phone, and an explicit opt-in
// on top of the device URL. Nothing in the repository sets the opt-in.
// implements: REQ-TEST-004 — skipped without EHEM_ALLOW_DISRUPTIVE=1; every action is announced before it happens.
import { describe } from 'vitest';
import { deviceEnv } from './integration-env.js';

/** Both gates: a configured device and `EHEM_ALLOW_DISRUPTIVE=1`. */
export const attendedAllowed: boolean = deviceEnv !== undefined && deviceEnv.allowDisruptive;

/** `describe` for attended tests: skipped, not failed, unless both gates are set. */
export const describeAttended = describe.skipIf(!attendedAllowed);

const noted = Symbol.for('encedo-hem-js-api.attended-tests-note');
const state = globalThis as { [noted]?: true };
if (deviceEnv !== undefined && !deviceEnv.allowDisruptive && !state[noted]) {
  state[noted] = true;
  process.stderr.write('EHEM_ALLOW_DISRUPTIVE is not set to 1: attended tests are skipped (they need a person at the device)\n');
}

/** Say what is about to be done to the device, before doing it. */
export function announce(action: string): void {
  process.stderr.write(`[attended] about to: ${action}\n`);
}
