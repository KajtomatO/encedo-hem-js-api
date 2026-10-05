import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HemAbortError, HemTimeoutError, HemUnreachableError, HemValidationError } from '../../src/errors.js';
import { DEFAULT_TIMEOUT_MS, Transport, type TransportRequest } from '../../src/transport/transport.js';
import { FakeFetch } from '../support/fake-fetch.js';

const request = (extra: Partial<TransportRequest> = {}): TransportRequest => ({
  operation: 'system.status',
  method: 'GET',
  path: '/api/system/status',
  ...extra,
});

/** Start a call and capture its outcome without leaving a rejection unhandled. */
const outcome = (promise: Promise<unknown>): Promise<unknown> => promise.then((value) => ({ value }), (error: unknown) => error);

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('time limit', () => {
  // verifies: REQ-NET-004
  it('defaults to 30 000 ms: a fetch that never settles rejects with HemTimeoutError at the limit and its signal is aborted', async () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const result = outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request()));

    await vi.advanceTimersByTimeAsync(29_999);
    expect(fake.last.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);

    const error = await result;
    expect(error).toBeInstanceOf(HemTimeoutError);
    expect((error as HemTimeoutError).operation).toBe('system.status');
    expect(fake.last.signal?.aborted).toBe(true);
    expect(fake.last.signal?.reason).toBe(error);
  });

  // verifies: REQ-NET-004
  it('takes a per-client limit, and a per-call limit overrides it', async () => {
    const fake = new FakeFetch().always('GET', '/api/system/status', 'hang');
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch, timeoutMs: 5_000 });

    const perClient = outcome(transport.send(request()));
    const perCall = outcome(transport.send(request({ timeoutMs: 100 })));
    await vi.advanceTimersByTimeAsync(100);
    expect(await perCall).toBeInstanceOf(HemTimeoutError);
    await vi.advanceTimersByTimeAsync(4_899);
    expect(fake.requests[0]?.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await perClient).toBeInstanceOf(HemTimeoutError);
  });

  // verifies: REQ-NET-004
  it('also covers reading the response body', async () => {
    const stalled = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"partial":'));
      },
    });
    const fake = new FakeFetch().on('GET', '/api/system/status', new Response(stalled, { status: 200 }));
    const result = outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch, timeoutMs: 1_000 }).send(request()));

    await vi.advanceTimersByTimeAsync(1_000);
    expect(await result).toBeInstanceOf(HemTimeoutError);
  });

  // verifies: REQ-NET-004
  it('clears its timer once the response is complete', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: {} });
    await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request());
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects a limit of %d with HemValidationError', async (timeoutMs) => {
    const fake = new FakeFetch();
    expect(() => new Transport({ url: 'https://hem.test', fetch: fake.fetch, timeoutMs })).toThrow(HemValidationError);
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });
    await expect(transport.send(request({ timeoutMs }))).rejects.toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('cancellation', () => {
  // verifies: REQ-NET-005, REQ-NET-006
  it('rejects with HemAbortError when the caller aborts during the request, and aborts the signal given to fetch', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const controller = new AbortController();
    const result = outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request({ signal: controller.signal })));

    await vi.advanceTimersByTimeAsync(10);
    const reason = new Error('shutting down');
    controller.abort(reason);

    const error = await result;
    expect(error).toBeInstanceOf(HemAbortError);
    expect((error as HemAbortError).cause).toBe(reason);
    expect(fake.last.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  // verifies: REQ-NET-005
  it('rejects at once without calling fetch when the signal is already aborted', async () => {
    const fake = new FakeFetch();
    const error = await outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request({ signal: AbortSignal.abort() })));
    expect(error).toBeInstanceOf(HemAbortError);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-NET-005
  it('also cancels while the body is being read', async () => {
    const stalled = new ReadableStream<Uint8Array>({ start() {} });
    const fake = new FakeFetch().on('GET', '/api/system/status', new Response(stalled));
    const controller = new AbortController();
    const result = outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request({ signal: controller.signal })));
    await vi.advanceTimersByTimeAsync(5);
    controller.abort();
    expect(await result).toBeInstanceOf(HemAbortError);
  });
});

describe('failure classes', () => {
  // verifies: REQ-NET-006
  it('raises HemUnreachableError with the original error as cause when fetch rejects', async () => {
    const failure = new TypeError('fetch failed');
    const fake = new FakeFetch().on('GET', '/api/system/status', failure);
    const error = await outcome(new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request()));
    expect(error).toBeInstanceOf(HemUnreachableError);
    expect((error as HemUnreachableError).cause).toBe(failure);
    expect((error as HemUnreachableError).status).toBeUndefined();
  });

  // verifies: REQ-NET-006
  it('lets the time limit decide when it fires before the caller aborts', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const controller = new AbortController();
    const result = outcome(
      new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request({ signal: controller.signal, timeoutMs: 50 })),
    );
    await vi.advanceTimersByTimeAsync(50);
    controller.abort();
    expect(await result).toBeInstanceOf(HemTimeoutError);
  });

  // verifies: REQ-NET-006
  it('lets the caller abort decide when it fires before the time limit', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', 'hang');
    const controller = new AbortController();
    const result = outcome(
      new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(request({ signal: controller.signal, timeoutMs: 50 })),
    );
    await vi.advanceTimersByTimeAsync(49);
    controller.abort();
    await vi.advanceTimersByTimeAsync(10);
    expect(await result).toBeInstanceOf(HemAbortError);
  });

  // verifies: REQ-NET-006
  it('classifies a fetch that ignores the signal by what stopped it, not by its later rejection', async () => {
    let rejectLater: (error: Error) => void = () => {};
    const stubborn = (): Promise<Response> => new Promise((_, reject) => (rejectLater = reject));
    const result = outcome(new Transport({ url: 'https://hem.test', fetch: stubborn, timeoutMs: 20 }).send(request()));
    await vi.advanceTimersByTimeAsync(20);
    rejectLater(new TypeError('late failure'));
    expect(await result).toBeInstanceOf(HemTimeoutError);
  });
});
