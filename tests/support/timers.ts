// supports: REQ-TEST-001
// Helpers for tests that run under fake timers in Node and in the browser.
import { vi } from "vitest";

/** One real macrotask turn (MessageChannel is not faked by Vitest). */
export function realTick(): Promise<void> {
  return new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => {
      ch.port1.close();
      resolve();
    };
    ch.port2.postMessage(0);
  });
}

/**
 * Advances fake time in small steps, letting real I/O (such as reading a
 * Response body in a browser) settle between steps, until `promise` settles
 * or `maxMs` of fake time has passed.
 */
export async function advanceUntilSettled<T>(promise: Promise<T>, maxMs = 120_000, stepMs = 10): Promise<T> {
  let settled = false;
  const watched = promise.finally(() => {
    settled = true;
  });
  watched.catch(() => {});
  for (let t = 0; t < maxMs && !settled; t += stepMs) {
    await realTick();
    if (settled) break;
    await vi.advanceTimersByTimeAsync(stepMs);
  }
  await realTick();
  return promise;
}
