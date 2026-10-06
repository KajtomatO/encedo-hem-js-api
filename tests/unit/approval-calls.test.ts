import { describe, expect, it } from 'vitest';
import { type OperationSpec, invoke } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import {
  type ApprovalRelay,
  type CheckinRelay,
  HemClient,
  type HemClientOptions,
  HemForbiddenError,
  HemOperationFailedError,
  HemUnauthenticatedError,
  HemValidationError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, fakeToken } from '../support/login.js';

const EPK = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const AUTHREQ = 'eyJhbGciOiJIUzI1NiJ9.eyJzY29wZSI6e319.c2ln';
const NOW_S = 1_800_000_000;
const KID = '0123456789abcdef0123456789abcdef';

const relay: CheckinRelay = { exchange: () => Promise.resolve('checked') };
const newClient = (fake: FakeFetch, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, now: () => NOW_S * 1000, checkinRelay: relay, approvalRelay: null, ...extra });

describe('auth.requestApproval (ext/request)', () => {
  // verifies: REQ-AUTH-014
  it('posts {epk, scope} without Authorization and returns {authreq, epk} unmodified', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/request', { body: { authreq: AUTHREQ, epk: EPK, extra: 1 } });
    expect(await newClient(fake).auth.requestApproval({ epk: EPK, scope: 'keymgmt:list' })).toEqual({ authreq: AUTHREQ, epk: EPK });
    expect(fake.last.method).toBe('POST');
    expect(fake.last.url.href).toBe('https://my.ence.do/api/auth/ext/request');
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(fake.last.text()).toBe(`{"epk":"${EPK}","scope":"keymgmt:list"}`);
  });

  // verifies: REQ-AUTH-014
  it('adds ctx and note when given', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/request', { body: { authreq: AUTHREQ, epk: EPK } });
    await newClient(fake).auth.requestApproval({ epk: EPK, scope: `keymgmt:use:${KID}`, ctx: 'c'.repeat(64), note: 'n'.repeat(128) });
    expect(fake.last.json()).toEqual({ epk: EPK, scope: `keymgmt:use:${KID}`, ctx: 'c'.repeat(64), note: 'n'.repeat(128) });
  });

  // verifies: REQ-AUTH-014
  it.each([
    [{ epk: 'AQID' }, 'epk'],
    [{ epk: `${EPK}AAAA` }, 'epk'],
    [{ epk: 'not base64!' }, 'epk'],
    [{ scope: 's'.repeat(1024) }, 'scope'],
    [{ scope: '' }, 'scope'],
    [{ ctx: '' }, 'ctx'],
    [{ ctx: 'c'.repeat(65) }, 'ctx'],
    [{ note: '' }, 'note'],
    [{ note: 'n'.repeat(129) }, 'note'],
  ])('rejects %j with HemValidationError naming %s and no request', async (override, parameter) => {
    const fake = new FakeFetch();
    const error = await newClient(fake).auth.requestApproval({ epk: EPK, scope: 'keymgmt:list', ...override }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-AUTH-014
  it('accepts a 1023-character scope', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/request', { body: { authreq: AUTHREQ, epk: EPK } });
    await newClient(fake).auth.requestApproval({ epk: EPK, scope: 's'.repeat(1023) });
    expect(fake.requests).toHaveLength(1);
  });

  // verifies: REQ-AUTH-014
  it('answers a 403 with one check-in and one repeated request, never more', async () => {
    const fake = new FakeFetch()
      .on('POST', '/api/auth/ext/request', { status: 403 }, { body: { authreq: AUTHREQ, epk: EPK } })
      .always('GET', '/api/system/checkin', { body: { check: 'c' } })
      .always('POST', '/api/system/checkin', { body: { status: 'OK' } });
    await newClient(fake).auth.requestApproval({ epk: EPK, scope: 'keymgmt:list' });
    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'POST /api/auth/ext/request',
      'GET /api/system/checkin',
      'POST /api/system/checkin',
      'POST /api/auth/ext/request',
    ]);

    const failing = new FakeFetch()
      .always('POST', '/api/auth/ext/request', { status: 403 })
      .always('GET', '/api/system/checkin', { body: { check: 'c' } })
      .always('POST', '/api/system/checkin', { body: { status: 'OK' } });
    await expect(newClient(failing).auth.requestApproval({ epk: EPK, scope: 'keymgmt:list' })).rejects.toThrow(HemForbiddenError);
    expect(failing.requestsTo('POST', '/api/auth/ext/request')).toHaveLength(2);
    expect(failing.requestsTo('POST', '/api/system/checkin')).toHaveLength(1);
  });
});

describe('auth.redeemApproval (ext/token)', () => {
  const appToken = fakeToken({ sub: 'YXBwLWtleS1pZA==', scope: 'keymgmt:list', exp: NOW_S + 900 });

  // verifies: REQ-AUTH-015
  it('posts {authreply} without Authorization and returns the token', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/token', { body: { token: appToken } });
    expect(await newClient(fake).auth.redeemApproval({ authreply: 'reply.jws.sig', scope: 'keymgmt:list' })).toBe(appToken);
    expect(fake.last.url.href).toBe('https://my.ence.do/api/auth/ext/token');
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(fake.last.text()).toBe('{"authreply":"reply.jws.sig"}');
  });

  // verifies: REQ-AUTH-015
  it('caches the token under the requested scope until its exp claim', async () => {
    let now = NOW_S * 1000;
    const op: OperationSpec = { name: 'test.op', group: 'keymgmt', method: 'GET', path: '/api/test', scope: 'keymgmt:list', tlsOnly: false, required: [] };
    const fake = new FakeFetch().on('POST', '/api/auth/ext/token', { body: { token: appToken } }).always('GET', '/api/test', { body: {} });
    // No passphrase: the only way to a token is the redeemed approval.
    const client = newClient(fake, { now: () => now });
    await client.auth.redeemApproval({ authreply: 'r', scope: 'keymgmt:list' });

    await invoke(contextOf(client), op, {});
    expect(fake.last.headers['authorization']).toBe(`Bearer ${appToken}`);
    expect(client.auth.role).toEqual({ kind: 'app', id: 'YXBwLWtleS1pZA==' });

    now = (NOW_S + 900 - 61) * 1000;
    await invoke(contextOf(client), op, {});
    now = (NOW_S + 900 - 60) * 1000;
    // Past the margin the token is not used; without a credential no new one can be obtained.
    await expect(invoke(contextOf(client), op, {})).rejects.toThrow(/no credentials/);
    expect(claimsOf(appToken)['exp']).toBe(NOW_S + 900);
  });

  // verifies: REQ-AUTH-015
  it('raises HemUnauthenticatedError for a 401 without retrying, and HemOperationFailedError for a 406', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/token', { status: 401 }, { status: 406 });
    const client = newClient(fake, { passphrase: 'p' });
    await expect(client.auth.redeemApproval({ authreply: 'r', scope: 'keymgmt:list' })).rejects.toThrow(HemUnauthenticatedError);
    await expect(client.auth.redeemApproval({ authreply: 'r', scope: 'keymgmt:list' })).rejects.toThrow(HemOperationFailedError);
    expect(fake.requests.map((r) => r.path)).toEqual(['/api/auth/ext/token', '/api/auth/ext/token']);
  });

  it('does not put the token into the error of a malformed reply', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/ext/token', { body: `{"tokn":"${appToken}"` });
    const error = await newClient(fake).auth.redeemApproval({ authreply: 'r', scope: 'keymgmt:list' }).catch((e: unknown) => e);
    expect(JSON.stringify(error) + String((error as Error).message) + String((error as Error).cause)).not.toContain(appToken);
  });
});

describe('approval relay option', () => {
  // verifies: REQ-AUTH-016
  it('accepts any implementation of the exported interface, or none', () => {
    const custom: ApprovalRelay = {
      getKey: () => Promise.resolve(EPK),
      submit: () => Promise.resolve('handle'),
      check: () => Promise.resolve({ status: 'pending' }),
    };
    const fake = new FakeFetch();
    expect(newClient(fake, { approvalRelay: custom }).auth.approvalRelay).toBe(custom);
    expect(newClient(fake, { approvalRelay: null }).auth.approvalRelay).toBeNull();
    expect(new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch }).auth.approvalRelay?.constructor.name).toBe('EncedoApprovalRelay');
  });
});
