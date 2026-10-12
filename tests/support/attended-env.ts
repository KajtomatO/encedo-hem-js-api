// Attended tests need a person at the device or the phone, and an explicit opt-in
// on top of the device URL. Nothing in the repository sets the opt-in.
// implements: REQ-TEST-004 — skipped without EHEM_ALLOW_DISRUPTIVE=1; every action is announced before it happens.
import { appendFileSync, mkdirSync } from 'node:fs';
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

/** Live log of an attended run, followed by whoever guides the person at the device. */
export const ATTENDED_LOG = 'tmp/attended.log';

/** One line to stderr and to {@link ATTENDED_LOG}, timestamped. */
export function say(line: string): void {
  const text = `[attended] ${new Date().toISOString().slice(11, 19)} ${line}\n`;
  process.stderr.write(text);
  try {
    mkdirSync('tmp', { recursive: true });
    appendFileSync(ATTENDED_LOG, text);
  } catch {
    // The stderr copy is enough.
  }
}

/** Say what is about to be done to the device, before doing it. */
export function announce(action: string): void {
  say(`about to: ${action}`);
}

/** Ask the person at the device to act now. */
export function yourTurn(action: string): void {
  say(`YOUR TURN: ${action}`);
}
