import { describe, expect, it } from 'vitest';
import { type OperationSpec, invoke } from '../../src/api/core.js';
import { showsDrift } from '../../src/auth/recovery.js';
import { contextOf } from '../../src/client.js';
import {
  type CheckinRelay,
  HemClient,
  type HemClientOptions,
  HemDeviceError,
  HemForbiddenError,
  HemRelayError,
  HemUnauthenticatedError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { issueToken, vectorChallenge } from '../support/login.js';
import { loginVector as v } from '../support/vectors.js';

const op: OperationSpec = { name: 'test.op', group: 'keymgmt', method: 'GET', path: '/api/test', scope: 'keymgmt:list', tlsOnly: false, required: [] };
const NOW_S = v.iat;
/** A challenge from a device whose clock agrees with ours (exp = device time + 60). */
const inSync = { ...vectorChallenge, exp: NOW_S + 60 };
/** A challenge from a device whose clock runs 10 minutes fast. */
const drifted = { ...vectorChallenge, exp: NOW_S + 600 + 60 };

class MemoryRelay implements CheckinRelay {
  calls = 0;
  constructor(private readonly fail?: Error) {}
  exchange(): Promise<string> {
    this.calls += 1;
    return this.fail ? Promise.reject(this.fail) : Promise.resolve('checked-reply');
  }
}

/** A device with working check-in; the login replies are scripted per test. */
const device = (): FakeFetch =>
  new FakeFetch()
    .always('GET', '/api/system/checkin', { body: { check: 'check-token' } })
    .always('POST', '/api/system/checkin', { body: { status: 'OK' } })
    .always('GET', '/api/test', { body: {} });

const newClient = (fake: FakeFetch, relay: CheckinRelay | null, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, passphrase: v.passphrase, now: () => NOW_S * 1000, checkinRelay: relay, ...extra });
const call = (client: HemClient) => invoke(contextOf(client), op, {});
const checkins = (fake: FakeFetch): number => fake.requestsTo('POST', '/api/system/checkin').length;
const sequence = (fake: FakeFetch): string[] => fake.requests.map((r) => `${r.method} ${r.path}`);

describe('drift evidence', () => {
  it('is a difference of more than 60 s between challenge exp − 60 and local time', () => {
    expect(showsDrift(NOW_S + 60, NOW_S * 1000)).toBe(false);
    expect(showsDrift(NOW_S + 120, NOW_S * 1000)).toBe(false);
    expect(showsDrift(NOW_S + 121, NOW_S * 1000)).toBe(true);
    expect(showsDrift(NOW_S - 1, NOW_S * 1000)).toBe(true);
    expect(showsDrift(NOW_S, NOW_S * 1000)).toBe(false);
  });
});

describe('clock recovery', () => {
  // verifies: REQ-AUTH-009, REQ-SYS-007
  it('answers a 403 on the challenge with one check-in and a repeated login that succeeds', async () => {
    const fake = device()
      .on('GET', '/api/auth/token', { status: 403 }, { body: inSync })
      .on('POST', '/api/auth/token', issueToken());
    const relay = new MemoryRelay();

    await expect(call(newClient(fake, relay))).resolves.toEqual({});

    expect(relay.calls).toBe(1);
    expect(sequence(fake)).toEqual([
      'GET /api/auth/token',
      'GET /api/system/checkin',
      'POST /api/system/checkin',
      'GET /api/auth/token',
      'POST /api/auth/token',
      'GET /api/test',
    ]);
  }, 60_000);

  // verifies: REQ-AUTH-009
  it('answers a 401 on the proof with drift evidence the same way, with a fresh challenge', async () => {
    const fake = device()
      .on('GET', '/api/auth/token', { body: drifted }, { body: { ...inSync, jti: 'fresh-nonce' } })
      .on('POST', '/api/auth/token', { status: 401 }, issueToken());
    const relay = new MemoryRelay();

    await expect(call(newClient(fake, relay))).resolves.toEqual({});

    expect(relay.calls).toBe(1);
    expect(sequence(fake)).toEqual([
      'GET /api/auth/token',
      'POST /api/auth/token',
      'GET /api/system/checkin',
      'POST /api/system/checkin',
      'GET /api/auth/token',
      'POST /api/auth/token',
      'GET /api/test',
    ]);
    const second = fake.requestsTo('POST', '/api/auth/token')[1]?.json() as { auth: string };
    expect(atob((second.auth.split('.')[1] as string).replace(/-/g, '+').replace(/_/g, '/'))).toContain('"jti":"fresh-nonce"');
  }, 60_000);

  // verifies: REQ-AUTH-009
  it('treats a 401 without drift evidence as a wrong passphrase: no check-in', async () => {
    const fake = device().on('GET', '/api/auth/token', { body: inSync }).on('POST', '/api/auth/token', { status: 401 });
    const relay = new MemoryRelay();
    await expect(call(newClient(fake, relay))).rejects.toThrow(HemUnauthenticatedError);
    expect(relay.calls).toBe(0);
    expect(checkins(fake)).toBe(0);
    expect(fake.requestsTo('GET', '/api/system/checkin')).toHaveLength(0);
  }, 60_000);

  // verifies: REQ-AUTH-009
  it('runs at most one check-in per acquisition and reports the second failure', async () => {
    const fake = device().always('GET', '/api/auth/token', { status: 403 });
    const relay = new MemoryRelay();
    const error = await call(newClient(fake, relay)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemForbiddenError);
    expect(relay.calls).toBe(1);
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(2);
  }, 60_000);

  // verifies: REQ-AUTH-009
  it.each([
    ['switched off', { clockRecovery: false }, new MemoryRelay()],
    ['without a relay', {}, null],
  ])('reports the original error with no check-in when recovery is %s', async (_, extra, relay) => {
    const fake = device().always('GET', '/api/auth/token', { status: 403 });
    const error = await call(newClient(fake, relay, extra)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemForbiddenError);
    expect((error as HemForbiddenError).status).toBe(403);
    expect(relay?.calls ?? 0).toBe(0);
    expect(fake.requestsTo('GET', '/api/system/checkin')).toHaveLength(0);
  });

  // verifies: REQ-AUTH-009
  it('reports the login error with the check-in failure as its cause when the check-in fails', async () => {
    const relayFailure = new HemRelayError('relay.checkin: the relay answered with HTTP 503', { operation: 'relay.checkin', status: 503 });
    const fake = device().always('GET', '/api/auth/token', { status: 403 });
    const error = await call(newClient(fake, new MemoryRelay(relayFailure))).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemForbiddenError);
    expect((error as HemForbiddenError).status).toBe(403);
    expect((error as HemForbiddenError).cause).toBe(relayFailure);
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(1);
  });

  it('attaches a failure of a device check-in step as the cause too', async () => {
    const fake = device().always('GET', '/api/auth/token', { status: 403 }).on('POST', '/api/system/checkin', { status: 500 });
    const error = await call(newClient(fake, new MemoryRelay())).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemForbiddenError);
    expect((error as HemForbiddenError).cause).toBeInstanceOf(HemDeviceError);
  });

  // verifies: REQ-SYS-007
  it('never lets a check-in trigger another check-in', async () => {
    // A device whose clock is unset and whose check-in fails with 401: both legs are public calls.
    const fake = device().always('GET', '/api/auth/token', { status: 403 }).on('POST', '/api/system/checkin', { status: 401 }, { status: 401 });
    const relay = new MemoryRelay();
    const client = newClient(fake, relay);

    await expect(client.system.checkin()).rejects.toThrow(HemUnauthenticatedError);
    expect(relay.calls).toBe(1);
    expect(fake.requestsTo('GET', '/api/auth/token')).toHaveLength(0);

    await expect(call(client)).rejects.toThrow(HemForbiddenError);
    expect(relay.calls).toBe(2); // one recovery check-in for the login, none triggered by it
    expect(checkins(fake)).toBe(2);
  });
});
