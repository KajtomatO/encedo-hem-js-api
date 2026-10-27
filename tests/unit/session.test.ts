import { afterEach, describe, expect, it, vi } from 'vitest';
import { type OperationSpec, invoke } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import {
  HemClient,
  type HemClientOptions,
  HemError,
  HemForbiddenError,
  HemUnauthenticatedError,
  HemUnsupportedError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, fakeToken, issueToken, vectorChallenge } from '../support/login.js';
import { loginVector as v } from '../support/vectors.js';

/** A test-only authenticated operation with a templated scope. */
const op = (scope: string, path = '/api/test/{x}'): OperationSpec => ({
  name: 'test.op',
  group: 'keymgmt',
  method: 'GET',
  path,
  scope,
  tlsOnly: false,
  required: [],
});

/** A fake device that issues tokens and answers the test operation. */
function device(sub = 'U'): FakeFetch {
  return new FakeFetch()
    .always('GET', '/api/auth/token', { body: vectorChallenge })
    .always('POST', '/api/auth/token', issueToken(sub))
    .always('GET', /^\/api\/test\//, { body: {} });
}

let clock = v.iat * 1000;
const newClient = (fake: FakeFetch, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, passphrase: v.passphrase, now: () => clock, checkinRelay: null, ...extra });
const call = (client: HemClient, scope: string, x = 'a') => invoke(contextOf(client), op(scope), { params: { x } });
const logins = (fake: FakeFetch): string[] =>
  fake.requestsTo('POST', '/api/auth/token').map((request) => claimsOf((request.json() as { auth: string }).auth)['scope'] as string);

afterEach(() => {
  clock = v.iat * 1000;
  vi.useRealTimers();
});

describe('token cache', () => {
  // verifies: REQ-AUTH-004
  it('logs in once for two calls needing the same scope, and separately per scope', async () => {
    const fake = device();
    const client = newClient(fake);
    await call(client, 'keymgmt:list');
    await call(client, 'keymgmt:list');
    await call(client, 'keymgmt:search');
    expect(logins(fake)).toEqual(['keymgmt:list', 'keymgmt:search']);
  });

  // verifies: REQ-AUTH-004, REQ-AUTH-005
  it('keys the cache by the exact scope string and attaches that scope’s token as a Bearer header', async () => {
    const fake = device();
    const client = newClient(fake);
    const kidA = '0123456789abcdef0123456789abcdef';
    const kidB = 'fedcba9876543210fedcba9876543210';
    await call(client, `keymgmt:use:${kidA}`);
    await call(client, `keymgmt:use:${kidB}`);
    await call(client, `keymgmt:use:${kidA}`);
    await call(client, 'keymgmt:list');
    await call(client, 'keymgmt:search');
    expect(logins(fake)).toEqual([`keymgmt:use:${kidA}`, `keymgmt:use:${kidB}`, 'keymgmt:list', 'keymgmt:search']);

    const calls = fake.requestsTo('GET', /^\/api\/test\//);
    const scopes = calls.map((request) => claimsOf((request.headers['authorization'] as string).replace(/^Bearer /, ''))['scope']);
    expect(scopes).toEqual([`keymgmt:use:${kidA}`, `keymgmt:use:${kidB}`, `keymgmt:use:${kidA}`, 'keymgmt:list', 'keymgmt:search']);
    for (const request of calls) expect(request.headers['authorization']).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
  });

  // verifies: REQ-AUTH-004, REQ-AUTH-007
  it('reads the expiry from the token’s exp claim', async () => {
    // The device issues a token that expires in 600 s, although 8 h were requested.
    const fake = device().on('POST', '/api/auth/token', { body: { token: fakeToken({ sub: 'U', exp: v.iat + 600 }) } });
    const client = newClient(fake);
    await call(client, 'keymgmt:list');
    clock = (v.iat + 600 - 61) * 1000;
    await call(client, 'keymgmt:list');
    expect(logins(fake)).toHaveLength(1);
    clock = (v.iat + 600 - 60) * 1000;
    await call(client, 'keymgmt:list');
    expect(logins(fake)).toHaveLength(2);
  });

  // verifies: REQ-AUTH-004
  it('falls back to the requested expiry when the token cannot be decoded', async () => {
    const fake = device().on('POST', '/api/auth/token', { body: { token: 'opaque-token' } });
    const client = newClient(fake, { tokenLifetimeSeconds: 1_000 });
    await call(client, 'keymgmt:list');
    expect(fake.last.headers['authorization']).toBe('Bearer opaque-token');
    clock = (v.iat + 1_000 - 61) * 1000;
    await call(client, 'keymgmt:list');
    expect(logins(fake)).toHaveLength(1);
    clock = (v.iat + 1_000 - 60) * 1000;
    await call(client, 'keymgmt:list');
    expect(logins(fake)).toHaveLength(2);
  });
});

describe('renewal', () => {
  // verifies: REQ-AUTH-007
  it('uses the cached token at 61 s before expiry and logs in first at 60 s', async () => {
    const fake = device();
    const client = newClient(fake);
    await call(client, 'keymgmt:gen');
    const exp = v.iat + 28_800;
    clock = (exp - 61) * 1000;
    await call(client, 'keymgmt:gen');
    expect(logins(fake)).toHaveLength(1);
    clock = (exp - 60) * 1000;
    await call(client, 'keymgmt:gen');
    expect(logins(fake)).toHaveLength(2);
    // The login came before the call.
    expect(fake.requests.slice(-3).map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/auth/token', 'POST /api/auth/token', 'GET /api/test/a']);
  });

  // verifies: REQ-AUTH-007
  it('starts no background timer', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
    const intervals = vi.spyOn(globalThis, 'setInterval');
    const fake = device();
    const client = newClient(fake);
    await call(client, 'keymgmt:gen');
    await call(client, 'keymgmt:gen');
    expect(vi.getTimerCount()).toBe(0);
    expect(intervals).not.toHaveBeenCalled();
  });
});

describe('roles', () => {
  // verifies: REQ-AUTH-010
  it.each([
    ['U', { kind: 'user' }],
    ['M', { kind: 'master' }],
    ['dGhlLWFwcC1rZXktaWQ=', { kind: 'app', id: 'dGhlLWFwcC1rZXktaWQ=' }],
  ])('reports sub %s as %j', async (sub, role) => {
    const client = newClient(device(sub));
    expect(client.auth.role).toBeUndefined();
    await call(client, 'system:config');
    expect(client.auth.role).toEqual(role);
  });

  // verifies: REQ-AUTH-010
  it('passes a master session’s 403 on a key operation through as HemForbiddenError', async () => {
    const fake = device('M').on('GET', '/api/test/a', { status: 403 });
    const client = newClient(fake);
    await expect(call(client, 'keymgmt:list')).rejects.toThrow(HemForbiddenError);
    expect(client.auth.role).toEqual({ kind: 'master' });
  });
});

describe('public operations', () => {
  // verifies: REQ-AUTH-012
  it('carry no Authorization header while tokens are cached', async () => {
    const fake = device()
      .always('GET', '/api/system/status', { body: { ctx: 0, uptime: 1, temp: 1, fls_state: 0 } })
      .always('GET', '/api/system/version', { body: { hwv: 'h', fwv: 'f', fwk: 'AA==', fws: 'AA==' } })
      .always('GET', '/api/system/checkin', { body: { check: 'c' } })
      .always('POST', '/api/system/checkin', { body: { status: 'OK' } });
    const client = newClient(fake);
    await call(client, 'keymgmt:list');
    await call(client, 'system:config');
    const before = fake.requests.length;

    await client.system.status();
    await client.system.version();
    await client.system.getCheckin();
    await client.system.postCheckin('reply');
    await call(client, 'keymgmt:search'); // a new login: both login steps

    const publicRequests = fake.requests.slice(before).filter((r) => !r.path.startsWith('/api/test/'));
    expect(publicRequests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'GET /api/system/status',
      'GET /api/system/version',
      'GET /api/system/checkin',
      'POST /api/system/checkin',
      'GET /api/auth/token',
      'POST /api/auth/token',
    ]);
    for (const request of publicRequests) expect(request.headers['authorization'], request.path).toBeUndefined();
  });
});

describe('logout', () => {
  // verifies: REQ-AUTH-011
  it('empties the cache; an authenticated call then fails without any request', async () => {
    const fake = device();
    const client = newClient(fake);
    await call(client, 'keymgmt:list');
    const session = contextOf(client).tokens as unknown as { cachedScopes: string[] };
    expect(session.cachedScopes).toEqual(['keymgmt:list']);

    client.auth.logout();
    expect(session.cachedScopes).toEqual([]);
    expect(client.auth.role).toBeUndefined();
    const before = fake.requests.length;
    await expect(call(client, 'keymgmt:list')).rejects.toThrow(HemUnauthenticatedError);
    await expect(call(client, 'keymgmt:gen')).rejects.toThrow(HemUnauthenticatedError);
    expect(fake.requests).toHaveLength(before);
  });

  it('leaves public calls working', async () => {
    const fake = device().on('GET', '/api/system/status', { body: { ctx: 0, uptime: 1, temp: 1, fls_state: 0 } });
    const client = newClient(fake);
    client.auth.logout();
    await expect(client.system.status()).resolves.toMatchObject({ ctx: 0 });
  });
});

describe('client isolation', () => {
  // verifies: REQ-API-001, REQ-AUTH-004
  it('two clients do not share tokens or credentials', async () => {
    const fakeA = device();
    const fakeB = device();
    const a = newClient(fakeA);
    const withoutCredential = new HemClient({ url: 'https://my.ence.do', fetch: fakeB.fetch, checkinRelay: null });
    await call(a, 'keymgmt:list');

    await expect(call(withoutCredential, 'keymgmt:list')).rejects.toThrow(HemUnsupportedError);
    expect(fakeB.requests).toHaveLength(0);

    const b = newClient(fakeB);
    await call(b, 'keymgmt:list');
    expect(logins(fakeB)).toEqual(['keymgmt:list']);
    expect(logins(fakeA)).toEqual(['keymgmt:list']); // b logged in on its own; a's token was not reused
    a.auth.logout();
    await call(b, 'keymgmt:list'); // unaffected by the other client's logout
  });
});

describe('time limit with a login first', () => {
  // verifies: REQ-NET-004
  it('applies to each request, not to the sum', async () => {
    const fake = new FakeFetch()
      .on('GET', '/api/auth/token', { body: vectorChallenge, delayMs: 200 })
      .on('POST', '/api/auth/token', async (request) => {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return (issueToken() as (r: typeof request) => ReturnType<typeof issueToken>)(request);
      })
      .on('GET', '/api/test/a', { body: {}, delayMs: 200 });
    // Each request takes 200 ms; the three together exceed the 300 ms limit.
    const client = newClient(fake, { timeoutMs: 300 });
    await expect(call(client, 'keymgmt:list')).resolves.toEqual({});
  });
});

describe('secrets in errors of authenticated calls', () => {
  // verifies: REQ-API-009
  it('the error of a failed authenticated call contains no token', async () => {
    const fake = device();
    const client = newClient(fake);
    await call(client, 'keymgmt:list', 'warm');
    const token = (fake.last.headers['authorization'] as string).replace('Bearer ', '');
    fake.on('GET', '/api/test/a', { status: 403, body: { echo: token } }).on('GET', '/api/test/b', { status: 500 });
    for (const x of ['a', 'b']) {
      const error = (await call(client, 'keymgmt:list', x).catch((e: unknown) => e)) as HemError;
      expect(error).toBeInstanceOf(HemError);
      for (const view of [error.message, JSON.stringify(error), String(error.bodyText), JSON.stringify(error.body ?? null), String(error.cause)]) {
        expect(view).not.toContain(token);
      }
    }
  });
});

describe('no token parameter', () => {
  // verifies: REQ-AUTH-005
  it('call options accept only a signal and a time limit', async () => {
    const fake = device();
    const client = newClient(fake);
    // @ts-expect-error a token cannot be passed
    await client.system.status({ token: 'x', signal: undefined }).catch(() => undefined);
    expect(fake.requestsTo('GET', '/api/system/status')[0]?.headers['authorization']).toBeUndefined();
  });
});
