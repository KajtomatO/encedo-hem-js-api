import { describe, expect, it } from 'vitest';
import {
  type CheckinRelay,
  EncedoCheckinRelay,
  HemClient,
  HemProtocolError,
  HemRelayError,
  HemUnauthenticatedError,
  HemUnsupportedError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const CHECK = 'eyJhbGciOiJIUzI1NiJ9.eyJub25jZSI6Ii8rPSJ9.c2ln+/=';
const CHECKED = 'eyJhbGciOiJFUzI1NiJ9.eyJzdGF0dXMiOiJPSyJ9.-_sig';

/** An in-memory relay that records what it was given. */
class MemoryRelay implements CheckinRelay {
  readonly seen: string[] = [];
  constructor(private readonly reply: string | Error) {}
  exchange(check: string): Promise<string> {
    this.seen.push(check);
    return this.reply instanceof Error ? Promise.reject(this.reply) : Promise.resolve(this.reply);
  }
}

const deviceClient = (fake: FakeFetch, relay: CheckinRelay | null): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, checkinRelay: relay });

describe('check-in step 1 (system.getCheckin)', () => {
  // verifies: REQ-SYS-004
  it('sends GET /api/system/checkin without Authorization and returns check unmodified', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/checkin', { body: { check: CHECK, extra: 1 } });
    expect(await deviceClient(fake, null).system.getCheckin()).toBe(CHECK);
    expect(fake.last.method).toBe('GET');
    expect(fake.last.headers).toEqual({});
    expect(fake.last.body).toBeUndefined();
  });

  // verifies: REQ-SYS-004
  it('raises HemProtocolError for a reply without check', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/checkin', { body: { other: 'x' } });
    await expect(deviceClient(fake, null).system.getCheckin()).rejects.toThrow(HemProtocolError);
  });
});

describe('check-in step 2 (system.postCheckin)', () => {
  // verifies: REQ-SYS-005
  it('posts {checked} unmodified without Authorization and maps the result', async () => {
    const fake = new FakeFetch()
      .on('POST', '/api/system/checkin', { body: { status: 'OK' } }, { body: { status: 'U', newcrt: 'ERROR', newfws: 'fws==', newuis: 'uis', x: 1 } });
    const client = deviceClient(fake, null);

    expect(await client.system.postCheckin(CHECKED)).toEqual({ status: 'OK' });
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(fake.last.text()).toBe(JSON.stringify({ checked: CHECKED }));
    expect(fake.last.json()).toEqual({ checked: CHECKED });

    expect(await client.system.postCheckin(CHECKED)).toEqual({ status: 'U', newcrt: 'ERROR', newfws: 'fws==', newuis: 'uis' });
  });

  // verifies: REQ-SYS-005
  it('raises HemUnauthenticatedError on 401 without attempting a login', async () => {
    const fake = new FakeFetch().on('POST', '/api/system/checkin', { status: 401 });
    await expect(deviceClient(fake, null).system.postCheckin(CHECKED)).rejects.toThrow(HemUnauthenticatedError);
    expect(fake.requests.map((r) => r.path)).toEqual(['/api/system/checkin']);
  });

  it('requires status in the reply', async () => {
    const fake = new FakeFetch().on('POST', '/api/system/checkin', { body: { newcrt: 'OK' } });
    await expect(deviceClient(fake, null).system.postCheckin(CHECKED)).rejects.toThrow(HemProtocolError);
  });
});

describe('one-call check-in (system.checkin)', () => {
  // verifies: REQ-SYS-007, REQ-SYS-006
  it('runs the three legs in order with an in-memory relay, passing values on unchanged', async () => {
    const fake = new FakeFetch()
      .on('GET', '/api/system/checkin', { body: { check: CHECK } })
      .on('POST', '/api/system/checkin', { body: { status: 'OK', newcrt: 'OK' } });
    const relay = new MemoryRelay(CHECKED);

    const result = await deviceClient(fake, relay).system.checkin();

    expect(result).toEqual({ status: 'OK', newcrt: 'OK' });
    expect(relay.seen).toEqual([CHECK]);
    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/system/checkin', 'POST /api/system/checkin']);
    expect(fake.last.json()).toEqual({ checked: CHECKED });
    expect(fake.requests.every((r) => r.url.hostname === 'my.ence.do')).toBe(true);
  });

  // verifies: REQ-SYS-007
  it.each([
    ['system.getCheckin', 1],
    ['relay.checkin', 2],
    ['system.postCheckin', 3],
  ])('names the failing leg %s', async (leg, failAt) => {
    const fake = new FakeFetch()
      .on('GET', '/api/system/checkin', failAt === 1 ? { status: 500 } : { body: { check: CHECK } })
      .on('POST', '/api/system/checkin', failAt === 3 ? { status: 401 } : { body: { status: 'OK' } });
    const relay = new MemoryRelay(failAt === 2 ? new HemRelayError('relay.checkin: down', { operation: 'relay.checkin' }) : CHECKED);
    const error = await deviceClient(fake, relay).system.checkin().catch((e: unknown) => e);
    expect((error as { operation?: string }).operation).toBe(leg);
    expect((error as Error).message).toContain(leg);
  });

  // verifies: REQ-SYS-007
  it('raises HemUnsupportedError with no relay configured, before any request', async () => {
    const fake = new FakeFetch();
    await expect(deviceClient(fake, null).system.checkin()).rejects.toThrow(HemUnsupportedError);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-SYS-006
  it('uses the default Encedo relay unless one is given', async () => {
    const device = new FakeFetch()
      .on('GET', '/api/system/checkin', { body: { check: CHECK } })
      .on('POST', '/api/system/checkin', { body: { status: 'OK' } });
    const cloud = new FakeFetch().on('POST', '/checkin', { body: { checked: CHECKED } });
    // The default relay uses the global fetch; substitute it for this test.
    const original = globalThis.fetch;
    globalThis.fetch = cloud.fetch;
    try {
      await new HemClient({ url: 'https://my.ence.do', fetch: device.fetch }).system.checkin();
    } finally {
      globalThis.fetch = original;
    }
    expect(cloud.last.url.href).toBe('https://api.encedo.com/checkin');
    expect(cloud.last.json()).toEqual({ check: CHECK });
    expect(device.last.json()).toEqual({ checked: CHECKED });
  });
});

describe('default check-in relay (EncedoCheckinRelay)', () => {
  // verifies: REQ-SYS-006
  it('posts JSON {check} to https://api.encedo.com/checkin and returns checked', async () => {
    const cloud = new FakeFetch().on('POST', '/checkin', { body: { checked: CHECKED, other: 1 } });
    const relay = new EncedoCheckinRelay({ fetch: cloud.fetch });
    expect(relay.url).toBe('https://api.encedo.com/checkin');
    expect(await relay.exchange(CHECK)).toBe(CHECKED);
    expect(cloud.last.method).toBe('POST');
    expect(cloud.last.url.href).toBe('https://api.encedo.com/checkin');
    expect(cloud.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(cloud.last.text()).toBe(JSON.stringify({ check: CHECK }));
  });

  // verifies: REQ-SYS-006
  it('takes a configurable URL', async () => {
    const cloud = new FakeFetch().on('POST', '/my/checkin', { body: { checked: CHECKED } });
    await new EncedoCheckinRelay({ url: 'https://relay.example/my/checkin', fetch: cloud.fetch }).exchange(CHECK);
    expect(cloud.last.url.href).toBe('https://relay.example/my/checkin');
  });

  // verifies: REQ-SYS-006
  it('never uses the device fetch', async () => {
    const device = new FakeFetch().on('GET', '/api/system/checkin', { body: { check: CHECK } }).on('POST', '/api/system/checkin', { body: { status: 'OK' } });
    const cloud = new FakeFetch().on('POST', '/checkin', { body: { checked: CHECKED } });
    const client = new HemClient({ url: 'https://my.ence.do', fetch: device.fetch, checkinRelay: new EncedoCheckinRelay({ fetch: cloud.fetch }) });
    await client.system.checkin();
    expect(device.requests.some((r) => r.url.hostname === 'api.encedo.com')).toBe(false);
    expect(cloud.requests).toHaveLength(1);
  });

  // verifies: REQ-SYS-006
  it.each([
    [500, 'internal'],
    [404, ''],
    [201, '{"checked":"x"}'],
  ])('raises HemRelayError carrying status %i and the body', async (status, body) => {
    const cloud = new FakeFetch().on('POST', '/checkin', { status, body });
    const error = await new EncedoCheckinRelay({ fetch: cloud.fetch }).exchange(CHECK).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemRelayError);
    expect((error as HemRelayError).status).toBe(status);
    expect((error as HemRelayError).bodyText).toBe(body === '' ? undefined : body);
    expect((error as HemRelayError).operation).toBe('relay.checkin');
  });

  it('raises HemRelayError when the reply has no checked string, or the backend is unreachable', async () => {
    const failure = new TypeError('getaddrinfo ENOTFOUND api.encedo.com');
    const cloud = new FakeFetch().on('POST', '/checkin', { body: { nope: 1 } }, failure);
    const relay = new EncedoCheckinRelay({ fetch: cloud.fetch });
    await expect(relay.exchange(CHECK)).rejects.toThrow(HemRelayError);
    const error = await relay.exchange(CHECK).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemRelayError);
    expect((error as HemRelayError).cause).toBe(failure);
  });
});

describe('relay requests and the device queue', () => {
  // verifies: REQ-NET-007
  it('are not held behind a device request in flight', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const device = new FakeFetch().on('GET', '/api/system/status', async () => {
      await held;
      return { body: { ctx: 0, uptime: 1, temp: 1, fls_state: 0 } };
    });
    const cloud = new FakeFetch().on('POST', '/checkin', { body: { checked: CHECKED } });
    const relay = new EncedoCheckinRelay({ fetch: cloud.fetch });
    const client = new HemClient({ url: 'https://my.ence.do', fetch: device.fetch, checkinRelay: relay });

    const status = client.system.status();
    expect(await relay.exchange(CHECK)).toBe(CHECKED); // completes while the device request is still open
    release();
    await status;
  });
});

describe('relay time limit and cancellation', () => {
  it('ends a hanging relay call with HemTimeoutError at its limit', async () => {
    const cloud = new FakeFetch().on('POST', '/checkin', 'hang');
    const error = await new EncedoCheckinRelay({ fetch: cloud.fetch, timeoutMs: 20 }).exchange(CHECK).catch((e: unknown) => e);
    expect((error as Error).name).toBe('HemTimeoutError');
    expect(cloud.last.signal?.aborted).toBe(true);
  });

  it('ends a relay call with HemAbortError when the caller aborts', async () => {
    const cloud = new FakeFetch().on('POST', '/checkin', 'hang');
    const controller = new AbortController();
    const pending = new EncedoCheckinRelay({ fetch: cloud.fetch }).exchange(CHECK, { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'HemAbortError' });
  });
});
