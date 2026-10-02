// supports: REQ-TEST-001
// Replaces the global fetch with one that fails the test, so a request that
// was not routed through a substituted fetch cannot go unnoticed.
import { afterEach, beforeEach, vi } from "vitest";

export class UnexpectedGlobalFetchError extends Error {
  constructor(input: unknown) {
    super(`unexpected call to the global fetch: ${String(input)}`);
    this.name = "UnexpectedGlobalFetchError";
  }
}

export const globalFetchCalls: unknown[] = [];

function failingFetch(input: unknown): Promise<Response> {
  globalFetchCalls.push(input);
  throw new UnexpectedGlobalFetchError(input);
}

beforeEach(() => {
  globalFetchCalls.length = 0;
  vi.stubGlobal("fetch", failingFetch);
});

afterEach(() => {
  const calls = globalFetchCalls.length;
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (calls > 0) {
    throw new Error(`the global fetch was called ${calls} time(s) during the test`);
  }
});
