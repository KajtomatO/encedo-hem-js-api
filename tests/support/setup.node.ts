// Node-only test setup, on top of setup.ts: the Node.js device transport
// bypasses `fetch` (REQ-NET-013), so `node:http` and `node:https` requests are
// blocked too — except to the loopback address, where tests run local servers.
// supports: REQ-TEST-001
import http from 'node:http';
import https from 'node:https';
import { afterEach } from 'vitest';

const violations: string[] = [];
const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

/** The host a `request(url | options, [options], [callback])` call targets. */
function hostOf(args: unknown[]): string {
  const [first, second] = args;
  if (typeof first === 'string') return new URL(first).hostname;
  if (first instanceof URL) return first.hostname;
  const options = (typeof first === 'object' && first !== null ? first : typeof second === 'object' && second !== null ? second : {}) as {
    hostname?: string;
    host?: string;
  };
  return options.hostname ?? options.host ?? '';
}

for (const [name, mod] of [
  ['http', http],
  ['https', https],
] as const) {
  const original = mod.request as unknown as (...args: unknown[]) => unknown;
  (mod as unknown as { request: unknown }).request = function guardedRequest(this: unknown, ...args: unknown[]): unknown {
    const host = hostOf(args);
    if (LOOPBACK.has(host)) return original.apply(this, args);
    const description = `node:${name} request to ${host || '(unknown host)'}`;
    violations.push(description);
    throw new Error(`Unit tests must not use the network: unsubstituted ${description}`);
  };
}

/** Return and clear the blocked Node requests so far in this test. */
export function takeNodeNetworkViolations(): string[] {
  return violations.splice(0);
}

afterEach(() => {
  const blocked = takeNodeNetworkViolations();
  if (blocked.length > 0) {
    throw new Error(`Unit test attempted network access: ${blocked.join(', ')}`);
  }
});
