import { afterEach, describe, expect, it, vi } from 'vitest';
import { HemAbortError, HemDeviceError, HemUnreachableError, HemValidationError } from '../../src/errors.js';
import { Transport, type TransportRequest } from '../../src/transport/transport.js';
import { FakeFetch } from '../support/fake-fetch.js';

const status = (extra: Partial<TransportRequest> = {}): TransportRequest => ({
  operation: 'system.status',
  method: 'GET',
  path: '/api/system/status',
  ...extra,
});
const outcome = (promise: Promise<unknown>): Promise<unknown> => promise.then((value) => ({ value }), (error: unknown) => error);
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
// Captured before any test fakes the timers.
const realSetTimeout = globalThis.setTimeout;
const realTick = (): Promise<void> => new Promise((resolve) => realSetTimeout(resolve, 0));

/** Fake setTimeout, clearTimeout and Date together, so pacing arithmetic and timers agree. */
const fakeClock = (): void => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
};

/**
 * Advance fake time in small steps until `done()` holds. Between steps, real
 * tasks run, because in a browser `fetch` and body streams settle on real tasks.
 */
async function advanceUntil(done: () => boolean, stepMs = 10, maxSteps = 500): Promise<void> {
  for (let i = 0; i < maxSteps && !done(); i += 1) {
    await vi.advanceTimersByTimeAsync(stepMs);
    await realTick();
  }
  expect(done()).toBe(true);
}

/** A response whose body arrives only when `finish()` is called. */
function slowBody(text: string): { response: Response; finish: () => void } {
  let close: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      close = () => {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      };
    },
  });
  return { response: new Response(stream), finish: () => close() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('one request at a time', () => {
  // verifies: REQ-NET-007
  it('starts the next request only after the previous one settled and its body was read', async () => {
    const first = slowBody('{"n":1}');
    const second = slowBody('{"n":2}');
    const fake = new FakeFetch().on('GET', '/api/system/status', first.response, second.response, { body: { n: 3 } });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });

    const calls = [transport.send(status()), transport.send(status()), transport.send(status())];
    await tick();
    expect(fake.requests).toHaveLength(1); // first response headers are in, body is not

    first.finish();
    await tick();
    expect(fake.requests).toHaveLength(2);

    second.finish();
    const results = await Promise.all(calls);
    expect(results.map((response) => response.text())).toEqual(['{"n":1}', '{"n":2}', '{"n":3}']);
    expect(fake.requests).toHaveLength(3);
  });

  // verifies: REQ-NET-007
  it('sends requests in the order the calls were made', async () => {
    const fake = new FakeFetch().always('GET', /./, { body: {} }).always('POST', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    const paths = ['/api/a', '/api/b', '/api/c', '/api/d', '/api/e'];

    await Promise.all(paths.map((path, i) => transport.send({ operation: path, method: i % 2 ? 'POST' : 'GET', path })));

    expect(fake.requests.map((request) => request.path)).toEqual(paths);
  });

  // verifies: REQ-NET-007
  it('does not let a failed request block the ones behind it', async () => {
    const fake = new FakeFetch()
      .on('GET', '/api/system/status', new TypeError('connection reset'), { status: 500 }, { body: { ok: true } });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });

    const results = await Promise.all([outcome(transport.send(status())), outcome(transport.send(status())), outcome(transport.send(status()))]);

    expect(results[0]).toBeInstanceOf(HemUnreachableError);
    expect(results[1]).toBeInstanceOf(HemDeviceError);
    expect(results[2]).toMatchObject({ value: { status: 200 } });
  });

  // verifies: REQ-NET-005, REQ-NET-007
  it('removes a call aborted while waiting in the queue; it is never sent, and the others proceed', async () => {
    const first = slowBody('{}');
    const fake = new FakeFetch()
      .on('GET', '/api/system/status', first.response)
      .on('GET', '/api/system/version', { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    const controller = new AbortController();

    const a = outcome(transport.send(status()));
    const b = outcome(transport.send(status({ path: '/api/keymgmt/list', signal: controller.signal })));
    const c = outcome(transport.send(status({ path: '/api/system/version' })));
    await tick();
    controller.abort();
    expect(await b).toBeInstanceOf(HemAbortError);

    first.finish();
    await Promise.all([a, c]);
    expect(fake.requests.map((request) => request.path)).toEqual(['/api/system/status', '/api/system/version']);
  });

  it('refuses an already-aborted call without queueing it', async () => {
    const fake = new FakeFetch().always('GET', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    expect(await outcome(transport.send(status({ signal: AbortSignal.abort() })))).toBeInstanceOf(HemAbortError);
    await transport.send(status());
    expect(fake.requests).toHaveLength(1);
  });

  it('keeps separate queues for separate clients', async () => {
    const held = slowBody('{}');
    const fake = new FakeFetch().on('GET', '/api/system/status', held.response, { body: {} });
    const one = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    const two = new Transport({ url: 'https://hem.test', fetch: fake.fetch });

    const pending = one.send(status());
    await tick();
    await two.send(status());
    expect(fake.requests).toHaveLength(2);
    held.finish();
    await pending;
  });
});

describe('pacing', () => {
  // verifies: REQ-NET-008
  it('adds no delay and no timer by default', async () => {
    fakeClock();
    const fake = new FakeFetch().always('GET', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');

    await transport.send(status());
    await transport.send(status());

    expect(fake.requests).toHaveLength(2);
    // Only the time-limit timer of each request.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
    setTimeoutSpy.mockRestore();
  });

  // verifies: REQ-NET-008
  it('starts consecutive requests at least 150 ms apart with an interval of 150 ms', async () => {
    fakeClock();
    const starts: number[] = [];
    const fake = new FakeFetch().always('GET', /./, () => {
      starts.push(Date.now());
      return { body: {} };
    });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch, minIntervalMs: 150 });

    const calls = Promise.all([transport.send(status()), transport.send(status()), transport.send(status())]);
    await advanceUntil(() => starts.length === 3);
    await calls;

    expect(starts).toHaveLength(3);
    expect((starts[1] as number) - (starts[0] as number)).toBeGreaterThanOrEqual(150);
    expect((starts[2] as number) - (starts[1] as number)).toBeGreaterThanOrEqual(150);
  });

  // verifies: REQ-NET-008
  it('does not delay a request that comes after the interval has passed', async () => {
    fakeClock();
    const fake = new FakeFetch().always('GET', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch, minIntervalMs: 150 });
    await transport.send(status());
    await vi.advanceTimersByTimeAsync(200);
    const setTimeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    await transport.send(status());
    expect(fake.requests).toHaveLength(2);
    // Only the time-limit timer; no pacing wait.
    expect(setTimeoutSpy).toHaveBeenCalledTimes(1);
    setTimeoutSpy.mockRestore();
  });

  it('cancels a call waiting for its interval', async () => {
    fakeClock();
    const fake = new FakeFetch().always('GET', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch, minIntervalMs: 150 });
    await transport.send(status());
    const controller = new AbortController();
    const paced = outcome(transport.send(status({ signal: controller.signal })));
    await realTick();
    await vi.advanceTimersByTimeAsync(50);
    controller.abort();
    expect(await paced).toBeInstanceOf(HemAbortError);
    expect(fake.requests).toHaveLength(1);
    const next = transport.send(status());
    await advanceUntil(() => fake.requests.length === 2);
    await next;
    expect(fake.requests).toHaveLength(2);
  });

  // verifies: REQ-NET-008
  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY, 2_147_483_648])('rejects an interval of %d', (minIntervalMs) => {
    expect(() => new Transport({ url: 'https://hem.test', fetch: new FakeFetch().fetch, minIntervalMs })).toThrow(HemValidationError);
  });

  // verifies: REQ-NET-008
  it('accepts an interval of 0 and of the largest delay setTimeout honours', () => {
    const fake = new FakeFetch();
    expect(() => new Transport({ url: 'https://hem.test', fetch: fake.fetch, minIntervalMs: 0 })).not.toThrow();
    expect(() => new Transport({ url: 'https://hem.test', fetch: fake.fetch, minIntervalMs: 2_147_483_647 })).not.toThrow();
  });
});
