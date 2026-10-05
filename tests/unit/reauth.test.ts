import { afterEach, describe, expect, it, vi } from 'vitest';
import { type OperationSpec, invoke } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import { HemAbortError, HemClient, type HemClientOptions, HemDeviceStateError, HemUnauthenticatedError } from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, issueToken, vectorChallenge } from '../support/login.js';
import { loginVector as v } from '../support/vectors.js';

const op = (scope: string): OperationSpec => ({ name: 'test.op', group: 'keymgmt', method: 'GET', path: '/api/test/{x}', scope, tlsOnly: false, required: [] });
const newClient = (fake: FakeFetch, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, passphrase: v.passphrase, now: () => v.iat * 1000, checkinRelay: null, ...extra });
const call = (client: HemClient, scope = 'keymgmt:list', x = 'a', signal?: AbortSignal) =>
  invoke(contextOf(client), op(scope), { params: { x } }, { signal });
const sequence = (fake: FakeFetch, from = 0): string[] => fake.requests.slice(from).map((r) => `${r.method} ${r.path}`);
const loginDevice = (): FakeFetch =>
  new FakeFetch().always('GET', '/api/auth/token', { body: vectorChallenge }).always('POST', '/api/auth/token', issueToken());

afterEach(() => {
  vi.useRealTimers();
});

describe('re-authentication after a 401', () => {
  // verifies: REQ-AUTH-008
  it('discards the token, logs in again and repeats the call once: call, challenge, proof, call', async () => {
    const fake = loginDevice().always('GET', '/api/test/a', { body: {} });
    const client = newClient(fake);
    await call(client); // warm the cache
    const firstToken = fake.last.headers['authorization'];
    const from = fake.requests.length;
    fake.on('GET', '/api/test/a', { status: 401 });

    await expect(call(client)).resolves.toEqual({});

    expect(sequence(fake, from)).toEqual(['GET /api/test/a', 'GET /api/auth/token', 'POST /api/auth/token', 'GET /api/test/a']);
    expect(fake.requests[from]?.headers['authorization']).toBe(firstToken);
  }, 60_000);

  // verifies: REQ-AUTH-008
  it('raises HemUnauthenticatedError on a second 401, with no third attempt', async () => {
    const fake = loginDevice().always('GET', '/api/test/a', { status: 401 });
    const client = newClient(fake);
    const error = await call(client).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemUnauthenticatedError);
    expect((error as HemUnauthenticatedError).status).toBe(401);
    expect(fake.requestsTo('GET', '/api/test/a')).toHaveLength(2);
    expect(fake.requestsTo('POST', '/api/auth/token')).toHaveLength(2);
  }, 60_000);

  // verifies: REQ-AUTH-008
  it('discards only the token of the affected scope', async () => {
    const fake = loginDevice().always('GET', /^\/api\/test\//, { body: {} });
    const client = newClient(fake);
    await call(client, 'keymgmt:list');
    await call(client, 'keymgmt:search');
    fake.on('GET', '/api/test/a', { status: 401 });
    await call(client, 'keymgmt:list');
    await call(client, 'keymgmt:search');
    const scopes = fake.requestsTo('POST', '/api/auth/token').map((r) => claimsOf((r.json() as { auth: string }).auth)['scope']);
    expect(scopes).toEqual(['keymgmt:list', 'keymgmt:search', 'keymgmt:list']);
    const session = contextOf(client).tokens as unknown as { cachedScopes: string[] };
    expect(session.cachedScopes.sort()).toEqual(['keymgmt:list', 'keymgmt:search']);
  }, 60_000);

  it('does not retry other errors', async () => {
    const fake = loginDevice().on('GET', '/api/test/a', { status: 403 });
    await expect(call(newClient(fake))).rejects.toMatchObject({ status: 403 });
    expect(fake.requestsTo('GET', '/api/test/a')).toHaveLength(1);
  }, 60_000);

  it('never retries a public operation through a login', async () => {
    const fake = loginDevice().on('GET', '/api/system/status', { status: 401 });
    await expect(newClient(fake).system.status()).rejects.toThrow(HemUnauthenticatedError);
    expect(sequence(fake)).toEqual(['GET /api/system/status']);
  });

  // verifies: REQ-NET-008
  it('keeps the pacing interval for the repeated request', async () => {
    const fake = loginDevice().always('GET', '/api/test/a', { body: {} });
    // Stamp each request when fetch is called, the moment the transport starts it.
    const starts: number[] = [];
    const stamped: typeof fake.fetch = (input, init) => {
      starts.push(Date.now());
      return fake.fetch(input, init);
    };
    const client = new HemClient({ url: 'https://my.ence.do', fetch: stamped, passphrase: v.passphrase, now: () => v.iat * 1000, checkinRelay: null, minIntervalMs: 40 });
    await call(client);
    fake.on('GET', '/api/test/a', { status: 401 });
    starts.length = 0;
    await call(client);
    expect(sequence(fake).slice(-4)).toEqual(['GET /api/test/a', 'GET /api/auth/token', 'POST /api/auth/token', 'GET /api/test/a']);
    expect(starts).toHaveLength(4);
    for (let i = 1; i < starts.length; i += 1) {
      expect((starts[i] as number) - (starts[i - 1] as number)).toBeGreaterThanOrEqual(40);
    }
  }, 60_000);
});

describe('shared login', () => {
  // verifies: REQ-AUTH-013
  it('serves five concurrent calls for one scope with one challenge and one proof', async () => {
    const fake = loginDevice().always('GET', /^\/api\/test\//, { body: {} });
    const client = newClient(fake);
    await Promise.all(['a', 'b', 'c', 'd', 'e'].map((x) => call(client, 'keymgmt:list', x)));
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(1);
    expect(fake.requestsTo('POST', '/api/auth/token')).toHaveLength(1);
    expect(fake.requestsTo('GET', /^\/api\/test\//)).toHaveLength(5);
  }, 60_000);

  // verifies: REQ-AUTH-013
  it('rejects every waiting call with an error of the same class when the login fails, and the next call starts a new login', async () => {
    const fake = new FakeFetch()
      .on('GET', '/api/auth/token', { status: 409 })
      .always('GET', '/api/auth/token', { body: vectorChallenge })
      .always('POST', '/api/auth/token', issueToken())
      .always('GET', /^\/api\/test\//, { body: {} });
    const client = newClient(fake);

    const results = await Promise.all(['a', 'b', 'c'].map((x) => call(client, 'keymgmt:list', x).catch((e: unknown) => e)));
    for (const result of results) expect(result).toBeInstanceOf(HemDeviceStateError);
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(1);

    await expect(call(client)).resolves.toEqual({});
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(2);
  }, 60_000);

  // verifies: REQ-NET-005, REQ-AUTH-013
  it('lets one call be aborted without failing another call that shares the same login', async () => {
    let releaseChallenge: () => void = () => {};
    const challengeHeld = new Promise<void>((resolve) => (releaseChallenge = resolve));
    const fake = new FakeFetch()
      .on('GET', '/api/auth/token', async () => {
        await challengeHeld;
        return { body: vectorChallenge };
      })
      .always('POST', '/api/auth/token', issueToken())
      .always('GET', /^\/api\/test\//, { body: {} });
    const client = newClient(fake);
    const controller = new AbortController();

    const aborted = call(client, 'keymgmt:list', 'a', controller.signal).catch((e: unknown) => e);
    const other = call(client, 'keymgmt:list', 'b');
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    expect(await aborted).toBeInstanceOf(HemAbortError);

    releaseChallenge();
    await expect(other).resolves.toEqual({});
    expect(fake.requestsTo('POST', '/api/auth/token')).toHaveLength(1);
    expect(fake.requestsTo('GET', /^\/api\/test\//).map((r) => r.path)).toEqual(['/api/test/b']);
  }, 60_000);
});
