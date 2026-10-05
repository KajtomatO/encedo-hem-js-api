import { afterEach, describe, expect, it, vi } from 'vitest';
import { HemAbortError, HemClient, HemDeviceError, HemTimeoutError, HemUnreachableError } from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const base = { ctx: 0, uptime: 10, temp: 30, fls_state: 0 };
const client = (fake: FakeFetch, timeoutMs?: number): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, checkinRelay: null, timeoutMs });

afterEach(() => {
  vi.useRealTimers();
});

describe('system.health', () => {
  // verifies: REQ-SYS-003
  it('makes exactly one request, the status request, and reports a healthy device', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: { ...base, time: 1791201600 } });
    const report = await client(fake).system.health();
    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/system/status']);
    expect(fake.last.headers).toEqual({});
    expect(report).toMatchObject({ reachable: true, initialised: true, selfTestOk: true, clockSet: true, healthy: true });
    expect(report.status?.time).toBe(1791201600);
  });

  // verifies: REQ-SYS-003
  it.each([
    [{ ...base, inited: false, time: 1 }, { initialised: false, selfTestOk: true, clockSet: true }],
    [{ ...base, fls_state: 2, time: 1 }, { initialised: true, selfTestOk: false, clockSet: true }],
    [{ ...base }, { initialised: true, selfTestOk: true, clockSet: false }],
    [{ ...base, ts: '2026-10-05T00:00:00Z' }, { initialised: true, selfTestOk: true, clockSet: true }],
  ])('maps the facts from status %j and is healthy only when all four hold', async (status, facts) => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: status });
    const report = await client(fake).system.health();
    expect(report).toMatchObject({ reachable: true, ...facts });
    expect(report.healthy).toBe(facts.initialised && facts.selfTestOk && facts.clockSet);
  });

  // verifies: REQ-SYS-003
  it('reports an unreachable device without throwing', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', new TypeError('connect ECONNREFUSED'));
    const report = await client(fake).system.health();
    expect(report).toMatchObject({ reachable: false, initialised: false, selfTestOk: false, clockSet: false, healthy: false });
    expect(report.error).toBeInstanceOf(HemUnreachableError);
  });

  // verifies: REQ-SYS-003
  it('reports an elapsed time limit as unreachable without throwing', async () => {
    vi.useFakeTimers();
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const pending = client(fake, 2_000).system.health();
    await vi.advanceTimersByTimeAsync(2_000);
    const report = await pending;
    expect(report.reachable).toBe(false);
    expect(report.error).toBeInstanceOf(HemTimeoutError);
  });

  // verifies: REQ-SYS-003
  it('still raises HemAbortError when the caller aborts', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const controller = new AbortController();
    const pending = client(fake).system.health({ signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow(HemAbortError);
  });

  it('reports a device error as reachable but unhealthy, with the error', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { status: 500 });
    const report = await client(fake).system.health();
    expect(report).toMatchObject({ reachable: true, healthy: false });
    expect(report.error).toBeInstanceOf(HemDeviceError);
  });
});
