// Attended tests need a person at the device or the phone, and an explicit opt-in
// on top of the device URL. Nothing in the repository sets the opt-in.
// implements: REQ-TEST-004 — skipped without EHEM_ALLOW_DISRUPTIVE=1; every action is announced before it happens.
import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
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

/**
 * Announce the next action and wait until the person has agreed to it: the
 * guide creates `tmp/attended.go-<step>` once they say go. Nothing is sent
 * before that.
 */
export async function waitForGo(step: string, action: string, limitMs = 30 * 60_000): Promise<void> {
  say(`READY (${step}): ${action} — waiting for go`);
  const file = `tmp/attended.go-${step}`;
  const started = Date.now();
  while (!existsSync(file)) {
    if (Date.now() - started > limitMs) throw new Error(`No go for step ${step} within ${limitMs / 60_000} min`);
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  say(`GO (${step}) received`);
}

/** Run one step; a failure is written to the live log at once, then rethrown. */
export async function step<T>(name: string, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    const e = error as { name?: string; message?: string; status?: number; operation?: string; cause?: unknown };
    say(`(${name}) FAILED: ${e.name ?? 'Error'} ${e.status ?? ''} ${e.operation ?? ''} — ${e.message ?? String(error)}${e.cause ? ` — cause: ${String(e.cause)}` : ''}`);
    throw error;
  }
}
