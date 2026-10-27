// Live: HMAC, wrap and unwrap with stored EHEMTEST keys; one keymgmt:use:<kid>
// token serving both key get and a crypto call; the scope each M1 operation was
// accepted with. Findings go to the run log (prefix `[crypto]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type HemClient, HemError, createNodeFetch } from '../../src/index.js';
import type { FetchFunction } from '../../src/transport/transport.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { claimsOf } from '../support/login.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[crypto] ${label}: ${JSON.stringify(value)}\n`);
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);

/** Records every device request: method, path, the scope of its bearer, the status; and each login proof's scope. */
class ScopeRecorder {
  readonly requests: { method: string; path: string; scope: string | undefined; status: number }[] = [];
  readonly loginScopes: string[] = [];
  readonly fetch: FetchFunction;

  constructor(inner: FetchFunction = createNodeFetch()) {
    this.fetch = async (input, init) => {
      const path = new URL(input).pathname;
      const method = init.method ?? 'GET';
      if (method === 'POST' && path === '/api/auth/token') {
        const proof = JSON.parse(init.body as string) as { auth: string };
        this.loginScopes.push(claimsOf(proof.auth)['scope'] as string);
      }
      const auth = (init.headers as Record<string, string> | undefined)?.['Authorization'];
      const scope = auth?.startsWith('Bearer ') ? (claimsOf(auth.slice(7))['scope'] as string) : undefined;
      const response = await inner(input, init);
      this.requests.push({ method, path, scope, status: response.status });
      return response;
    };
  }
}

describeDevice('crypto operations with stored keys', () => {
  let client: HemClient;
  let recorder: ScopeRecorder;
  let keys: TestKeys;
  let hmacKid: string;
  let aesKid: string;

  beforeAll(async () => {
    recorder = new ScopeRecorder();
    client = deviceClient({ fetch: recorder.fetch });
    keys = new TestKeys(client);
    hmacKid = await keys.create({ type: 'SHA2-256' });
    aesKid = await keys.create({ type: 'AES256', descr: new TextEncoder().encode('EHEMTEST crypto') });
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
  }, 120_000);

  // verifies: REQ-OPS-001
  it('computes a 32-byte HMAC with a stored SHA2-256 key, the same for the same message twice', async () => {
    const msg = new TextEncoder().encode('tenant-42 data key derivation');
    const a = await client.crypto.hmac({ kid: hmacKid, msg });
    const b = await client.crypto.hmac({ kid: hmacKid, msg });
    const other = await client.crypto.hmac({ kid: hmacKid, msg: new TextEncoder().encode('another message') });
    log('hmac', { bytes: a.length, deterministic: same(a, b), differsForOtherMessage: !same(a, other) });
    expect(a).toHaveLength(32);
    expect(same(a, b)).toBe(true);
    expect(same(a, other)).toBe(false);
    const sent = recorder.requests.filter((r) => r.path === '/api/crypto/hmac/hash');
    expect(sent.every((r) => r.status === 200)).toBe(true);
  });

  // verifies: REQ-OPS-002, REQ-OPS-003
  it('wraps a 32-byte key into 40 bytes and unwraps it back; altered input fails', async () => {
    const dataKey = crypto.getRandomValues(new Uint8Array(32));
    const wrapped = await client.crypto.wrap({ kid: aesKid, msg: dataKey });
    const unwrapped = await client.crypto.unwrap({ kid: aesKid, msg: wrapped });
    log('wrap', { in: dataKey.length, out: wrapped.length, roundTrip: same(unwrapped, dataKey) });
    expect(wrapped).toHaveLength(40);
    expect(same(unwrapped, dataKey)).toBe(true);

    const altered = wrapped.slice();
    altered[5] = (altered[5] as number) ^ 0x01;
    const error = await client.crypto.unwrap({ kid: aesKid, msg: altered }).catch((e: unknown) => e);
    log('unwrap of altered input', error instanceof HemError ? { name: error.name, code: error.code, status: error.status } : String(error));
    expect(error).toBeInstanceOf(HemError);
  });

  // verifies: REQ-AUTH-005
  it('serves key get and a crypto call on the same key with one keymgmt:use:<kid> token', async () => {
    const fresh = new ScopeRecorder();
    const c = deviceClient({ fetch: fresh.fetch });
    await c.keys.get(hmacKid);
    await c.crypto.hmac({ kid: hmacKid, msg: Uint8Array.from([1, 2, 3]) });
    log('logins for get + hmac on one key', fresh.loginScopes);
    expect(fresh.loginScopes).toEqual([`keymgmt:use:${hmacKid}`]);
  });

  // verifies: REQ-AUTH-005
  it('records the scope every M1 operation was accepted with', async () => {
    const fresh = new ScopeRecorder();
    const c = deviceClient({ fetch: fresh.fetch });
    const k = new TestKeys(c);
    const kid = await k.create({ type: 'AES256', descr: Uint8Array.from([0xee, 0x01]) });
    await c.keys.get(kid);
    await c.keys.list();
    await c.keys.search({ descr: Uint8Array.from([0xee, 0x01]) });
    await c.crypto.wrap({ kid, msg: new Uint8Array(16) });
    await c.crypto.unwrap({ kid, msg: await c.crypto.wrap({ kid, msg: new Uint8Array(16) }) });
    await c.crypto.hmac({ kid: hmacKid, msg: Uint8Array.from([1]) });
    await k.cleanup();
    await c.system.status();
    const table = fresh.requests.filter((r) => r.path !== '/api/auth/token').map((r) => `${r.method} ${r.path.replace(/[0-9a-f]{32}/, '<kid>')} → ${r.scope?.replace(/[0-9a-f]{32}$/, '<kid>') ?? 'no token'} (${r.status})`);
    log('operation scopes', [...new Set(table)]);
    expect(fresh.requests.filter((r) => r.path !== '/api/auth/token').every((r) => r.status === 200)).toBe(true);
  });
});

