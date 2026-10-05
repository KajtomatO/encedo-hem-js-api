import { afterEach, describe, expect, it, vi } from 'vitest';
import { brokerDrift, jwtIat } from '../../src/auth/approval.js';
import { type OperationSpec, invoke } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import {
  type ApprovalCheck,
  type ApprovalRelay,
  type ApprovalSubmission,
  type CheckinRelay,
  HemAbortError,
  HemApprovalRejectedError,
  HemApprovalTimeoutError,
  HemClient,
  type HemClientOptions,
  HemRelayError,
  HemUnreachableError,
  HemUnsupportedError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { fakeToken } from '../support/login.js';
import { advanceUntil, fakeClock, track } from '../support/timers.js';

const NOW_S = 1_800_000_000;
const EPK = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const segment = (value: unknown): string => btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const authreqAt = (iat: number): string => `${segment({ alg: 'HS256' })}.${segment({ iat, scope: {} })}.c2ln`;
const TOKEN = fakeToken({ sub: 'YXBw', scope: 'keymgmt:list', exp: NOW_S + 900 });

/** An in-memory approval relay with scripted check outcomes. */
class MemoryRelay implements ApprovalRelay {
  readonly log: string[] = [];
  readonly submissions: ApprovalSubmission[] = [];
  constructor(
    private readonly outcomes: (ApprovalCheck | Error)[],
    private readonly submitFailures: Error[] = [],
  ) {}
  getKey(): Promise<string> {
    this.log.push('getKey');
    return Promise.resolve(EPK);
  }
  submit(submission: ApprovalSubmission): Promise<string> {
    this.log.push('submit');
    this.submissions.push(submission);
    const failure = this.submitFailures.shift();
    return failure ? Promise.reject(failure) : Promise.resolve(`event-${this.submissions.length}`);
  }
  check(handle: string): Promise<ApprovalCheck> {
    this.log.push(`check ${handle}`);
    const next = this.outcomes.length > 1 ? this.outcomes.shift() : this.outcomes[0];
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next ?? { status: 'pending' });
  }
}

const checkinRelay: CheckinRelay = { exchange: () => Promise.resolve('checked') };

function device(authreqIat = NOW_S): FakeFetch {
  return new FakeFetch()
    .always('POST', '/api/auth/ext/request', (request) => ({ body: { authreq: authreqAt(authreqIat), epk: (request.json() as { epk: string }).epk } }))
    .always('POST', '/api/auth/ext/token', { body: { token: TOKEN } })
    .always('GET', '/api/system/checkin', { body: { check: 'c' } })
    .always('POST', '/api/system/checkin', { body: { status: 'OK' } })
    .always('GET', '/api/test', { body: {} });
}

const newClient = (fake: FakeFetch, relay: ApprovalRelay | null, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, now: () => NOW_S * 1000, checkinRelay, approvalRelay: relay, ...extra });
const op: OperationSpec = { name: 'test.op', group: 'keymgmt', method: 'GET', path: '/api/test', scope: 'keymgmt:list', tlsOnly: false, required: [] };

afterEach(() => {
  vi.useRealTimers();
});

describe('begin', () => {
  // verifies: REQ-AUTH-018
  it('obtains the relay key, calls ext/request and submits the result, in that order', async () => {
    const fake = device();
    const relay = new MemoryRelay([{ status: 'pending' }]);
    const pending = await newClient(fake, relay).auth.beginApproval('keymgmt:list', { note: 'Open Mercato wants keys' });
    expect(pending).toEqual({ scope: 'keymgmt:list', handle: 'event-1' });
    expect(relay.log).toEqual(['getKey', 'submit']);
    expect(fake.requests.map((r) => r.path)).toEqual(['/api/auth/ext/request']);
    expect(fake.last.json()).toEqual({ epk: EPK, scope: 'keymgmt:list', note: 'Open Mercato wants keys' });
    expect(relay.submissions).toEqual([{ authreq: authreqAt(NOW_S), epk: EPK }]);
  });
});

describe('outcomes', () => {
  // verifies: REQ-AUTH-018, REQ-AUTH-016
  it('approved: completes with an in-memory relay, caches the token under the scope and resolves', async () => {
    const fake = device();
    const relay = new MemoryRelay([{ status: 'pending' }, { status: 'approved', authreply: 'reply.jws' }]);
    const client = newClient(fake, relay);
    const token = await client.auth.approve('keymgmt:list', {}, { intervalMs: 1 });
    expect(token).toBe(TOKEN);
    expect(fake.requestsTo('POST', '/api/auth/ext/token')[0]?.json()).toEqual({ authreply: 'reply.jws' });
    await invoke(contextOf(client), op, {});
    expect(fake.last.headers['authorization']).toBe(`Bearer ${TOKEN}`);
    expect(fake.requests.every((r) => r.url.hostname === 'my.ence.do')).toBe(true);
  });

  // verifies: REQ-AUTH-018
  it('rejected: raises HemApprovalRejectedError and never calls ext/token', async () => {
    const fake = device();
    const relay = new MemoryRelay([{ status: 'pending' }, { status: 'rejected' }]);
    await expect(newClient(fake, relay).auth.approve('keymgmt:list', {}, { intervalMs: 1 })).rejects.toThrow(HemApprovalRejectedError);
    expect(fake.requestsTo('POST', '/api/auth/ext/token')).toHaveLength(0);
  });

  // verifies: REQ-AUTH-018
  it('expired at the relay: raises HemApprovalTimeoutError', async () => {
    const relay = new MemoryRelay([{ status: 'expired' }]);
    await expect(newClient(device(), relay).auth.approve('keymgmt:list')).rejects.toThrow(HemApprovalTimeoutError);
  });

  it('pollApproval checks once and caches an approved token', async () => {
    const fake = device();
    const relay = new MemoryRelay([{ status: 'pending' }, { status: 'approved', authreply: 'r' }]);
    const client = newClient(fake, relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    expect(await client.auth.pollApproval(pending)).toEqual({ status: 'pending' });
    expect(await client.auth.pollApproval(pending)).toEqual({ status: 'approved', token: TOKEN });
    await invoke(contextOf(client), op, {});
    expect(fake.last.headers['authorization']).toBe(`Bearer ${TOKEN}`);
  });
});

describe('wait timing', () => {
  // verifies: REQ-AUTH-018
  it('polls every 5 s and times out at 60 s by default', async () => {
    fakeClock();
    const relay = new MemoryRelay([{ status: 'pending' }]);
    const client = newClient(device(), relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    const start = Date.now();
    const pollTimes: number[] = [];
    const check = relay.check.bind(relay);
    relay.check = (handle: string) => {
      pollTimes.push(Date.now() - start);
      return check(handle);
    };
    const wait = track(client.auth.waitForApproval(pending));
    await advanceUntil(() => wait.settled, 100);
    expect((await wait.result).error).toBeInstanceOf(HemApprovalTimeoutError);
    expect(pollTimes).toEqual(Array.from({ length: 13 }, (_, i) => i * 5_000));
  });

  // verifies: REQ-AUTH-018
  it('polls at least once even with a tiny limit', async () => {
    const relay = new MemoryRelay([{ status: 'approved', authreply: 'r' }]);
    const client = newClient(device(), relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    await expect(client.auth.waitForApproval(pending, { timeoutMs: 1, intervalMs: 1 })).resolves.toBe(TOKEN);
    expect(relay.log.filter((entry) => entry.startsWith('check'))).toHaveLength(1);
  });

  // verifies: REQ-AUTH-018
  it('keeps waiting through a transport error of one poll', async () => {
    const relay = new MemoryRelay([
      new HemRelayError('relay.approval.check: down', { operation: 'relay.approval.check' }),
      new HemUnreachableError('x'),
      new HemRelayError('relay.approval.check: HTTP 503', { status: 503 }),
      { status: 'approved', authreply: 'r' },
    ]);
    const client = newClient(device(), relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    await expect(client.auth.waitForApproval(pending, { intervalMs: 1 })).resolves.toBe(TOKEN);
  });

  it('ends the wait on a relay error that is not transient', async () => {
    const relay = new MemoryRelay([new HemRelayError('relay.approval.check: HTTP 400', { status: 400 })]);
    const client = newClient(device(), relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    await expect(client.auth.waitForApproval(pending, { intervalMs: 1 })).rejects.toThrow(HemRelayError);
  });

  // verifies: REQ-AUTH-018
  it('is cancelled by an AbortSignal', async () => {
    fakeClock();
    const relay = new MemoryRelay([{ status: 'pending' }]);
    const client = newClient(device(), relay);
    const pending = await client.auth.beginApproval('keymgmt:list');
    const controller = new AbortController();
    const wait = track(client.auth.waitForApproval(pending, { signal: controller.signal }));
    await advanceUntil(() => relay.log.filter((e) => e.startsWith('check')).length >= 2, 100);
    controller.abort();
    await advanceUntil(() => wait.settled);
    expect((await wait.result).error).toBeInstanceOf(HemAbortError);
  });
});

describe('without a relay', () => {
  // verifies: REQ-AUTH-016
  it('the engine raises HemUnsupportedError while ext/request and ext/token still work', async () => {
    const fake = device();
    const client = newClient(fake, null);
    await expect(client.auth.beginApproval('keymgmt:list')).rejects.toThrow(HemUnsupportedError);
    await expect(client.auth.approve('keymgmt:list')).rejects.toThrow(HemUnsupportedError);
    await expect(client.auth.pollApproval({ scope: 'keymgmt:list', handle: 'h' })).rejects.toThrow(HemUnsupportedError);
    expect(fake.requests).toHaveLength(0);
    await expect(client.auth.requestApproval({ epk: EPK, scope: 'keymgmt:list' })).resolves.toMatchObject({ epk: EPK });
    await expect(client.auth.redeemApproval({ authreply: 'r', scope: 'keymgmt:list' })).resolves.toBe(TOKEN);
  });
});

describe('broker drift recovery', () => {
  const unauthorised = (): HemRelayError => new HemRelayError('relay.approval.submit: the relay answered with HTTP 401', { operation: 'relay.approval.submit', status: 401 });

  it('reads iat from the authorization request and applies the +2 s / -15 s gates', () => {
    expect(jwtIat(authreqAt(123))).toBe(123);
    expect(jwtIat('opaque')).toBeUndefined();
    expect(jwtIat('a.!!!.c')).toBeUndefined();
    const now = NOW_S * 1000;
    expect(brokerDrift(authreqAt(NOW_S + 2), now)).toBe(false);
    expect(brokerDrift(authreqAt(NOW_S + 3), now)).toBe(true);
    expect(brokerDrift(authreqAt(NOW_S - 15), now)).toBe(false);
    expect(brokerDrift(authreqAt(NOW_S - 16), now)).toBe(true);
    expect(brokerDrift('opaque', now)).toBe(false);
  });

  // verifies: REQ-AUTH-020
  it('answers a 401 with drift evidence with one check-in, a new ext/request and a new submit', async () => {
    const fake = device(NOW_S + 14);
    const relay = new MemoryRelay([{ status: 'pending' }], [unauthorised()]);
    const pending = await newClient(fake, relay).auth.beginApproval('keymgmt:list');
    expect(pending.handle).toBe('event-2');
    expect(relay.log).toEqual(['getKey', 'submit', 'getKey', 'submit']);
    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual([
      'POST /api/auth/ext/request',
      'GET /api/system/checkin',
      'POST /api/system/checkin',
      'POST /api/auth/ext/request',
    ]);
  });

  // verifies: REQ-AUTH-020
  it('does this at most once per approval attempt', async () => {
    const fake = device(NOW_S + 14);
    const relay = new MemoryRelay([{ status: 'pending' }], [unauthorised(), unauthorised(), unauthorised()]);
    const error = await newClient(fake, relay).auth.beginApproval('keymgmt:list').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemRelayError);
    expect((error as HemRelayError).status).toBe(401);
    expect(fake.requestsTo('POST', '/api/system/checkin')).toHaveLength(1);
    expect(relay.submissions).toHaveLength(2);
  });

  // verifies: REQ-AUTH-020
  it('reports a 401 without drift evidence with zero check-in requests', async () => {
    for (const iat of [NOW_S, NOW_S + 2, NOW_S - 15]) {
      const fake = device(iat);
      const relay = new MemoryRelay([{ status: 'pending' }], [unauthorised()]);
      await expect(newClient(fake, relay).auth.beginApproval('keymgmt:list')).rejects.toThrow(HemRelayError);
      expect(fake.requestsTo('GET', '/api/system/checkin')).toHaveLength(0);
    }
  });

  it('does not recover other submit failures', async () => {
    const fake = device(NOW_S + 100);
    const relay = new MemoryRelay([{ status: 'pending' }], [new HemRelayError('x', { status: 500 })]);
    await expect(newClient(fake, relay).auth.beginApproval('keymgmt:list')).rejects.toThrow(HemRelayError);
    expect(fake.requestsTo('GET', '/api/system/checkin')).toHaveLength(0);
  });
});
