// Test setup for every unit test file, in Node and in the browser.
// supports: REQ-TEST-001 — the global `fetch` is replaced with one that fails
// the test, so a request that was not substituted cannot reach the network.
import { afterEach } from 'vitest';

const violations: string[] = [];

function describeRequest(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
  const url = input instanceof Request ? input.url : String(input);
  return `${method.toUpperCase()} ${url}`;
}

/** The guard installed as `globalThis.fetch`. */
export const blockedFetch: typeof globalThis.fetch = (input, init) => {
  const request = describeRequest(input, init);
  violations.push(request);
  return Promise.reject(new Error(`Unit tests must not use the network: unsubstituted fetch of ${request}`));
};

/** Return and clear the requests the guard has blocked so far in this test. */
export function takeNetworkViolations(): string[] {
  return violations.splice(0);
}

globalThis.fetch = blockedFetch;

// A blocked request fails its test even when the code under test swallowed the rejection.
afterEach(() => {
  const blocked = takeNetworkViolations();
  globalThis.fetch = blockedFetch;
  if (blocked.length > 0) {
    throw new Error(`Unit test attempted network access: ${blocked.join(', ')}`);
  }
});
