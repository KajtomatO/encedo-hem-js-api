// Fake-timer helpers that also work in the browser, where fetch and body
// streams settle on real tasks rather than microtasks.
// supports: REQ-TEST-002
import { expect, vi } from 'vitest';

// Captured at import, before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout;

/** Let real tasks run. */
export const realTick = (): Promise<void> => new Promise((resolve) => realSetTimeout(resolve, 0));

/** Fake setTimeout, clearTimeout and Date together. */
export function fakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
}

/** Advance fake time in small steps, with real ticks between them, until `done()` holds. */
export async function advanceUntil(done: () => boolean, stepMs = 10, maxSteps = 20_000): Promise<void> {
  for (let i = 0; i < maxSteps && !done(); i += 1) {
    await vi.advanceTimersByTimeAsync(stepMs);
    await realTick();
  }
  expect(done()).toBe(true);
}

/** Track a promise's settlement without leaving a rejection unhandled. */
export function track<T>(promise: Promise<T>): { readonly settled: boolean; readonly result: Promise<{ value?: T; error?: unknown }> } {
  const state = { settled: false, result: undefined as unknown as Promise<{ value?: T; error?: unknown }> };
  state.result = promise.then(
    (value) => {
      state.settled = true;
      return { value };
    },
    (error: unknown) => {
      state.settled = true;
      return { error };
    },
  );
  return state;
}
