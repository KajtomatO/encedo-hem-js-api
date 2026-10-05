import { describe, expect, it } from 'vitest';
import { FakeFetch } from '../support/fake-fetch.js';

describe('FakeFetch', () => {
  // verifies: REQ-TEST-001
  it('answers a scripted route with JSON and records the request', async () => {
    const fake = new FakeFetch().on('POST', '/api/auth/token', { body: { token: 'abc' } });

    const response = await fake.fetch('https://hem.test/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
      body: JSON.stringify({ auth: 'proof' }),
      redirect: 'error',
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(await response.json()).toEqual({ token: 'abc' });
    expect(fake.requests).toHaveLength(1);
    expect(fake.last.method).toBe('POST');
    expect(fake.last.path).toBe('/api/auth/token');
    expect(fake.last.url.origin).toBe('https://hem.test');
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer x' });
    expect(fake.last.json()).toEqual({ auth: 'proof' });
    expect(fake.last.redirect).toBe('error');
  });

  // verifies: REQ-TEST-001
  it('consumes one-shot replies in order and reports unconsumed ones', async () => {
    const fake = new FakeFetch().on('GET', '/api/x', { status: 401 }, { status: 200, body: 'ok' }, { status: 500 });

    expect((await fake.fetch('https://hem.test/api/x')).status).toBe(401);
    const second = await fake.fetch('https://hem.test/api/x');
    expect([second.status, await second.text()]).toEqual([200, 'ok']);
    expect(fake.pending).toEqual([{ method: 'GET', path: '/api/x', count: 1 }]);
  });

  // verifies: REQ-TEST-001
  it('repeats a sticky reply and matches regular expressions against path and query', async () => {
    const fake = new FakeFetch().always('GET', /^\/api\/keymgmt\/list\/\d+\/\d+$/, { body: { list: [] } });

    await fake.fetch('https://hem.test/api/keymgmt/list/0/15');
    await fake.fetch('https://hem.test/api/keymgmt/list/15/15');

    expect(fake.requestsTo('GET', /list/).map((request) => request.path)).toEqual([
      '/api/keymgmt/list/0/15',
      '/api/keymgmt/list/15/15',
    ]);
    expect(fake.pending).toEqual([]);
  });

  // verifies: REQ-TEST-001
  it('rejects an unscripted request with a message naming it', async () => {
    const fake = new FakeFetch().on('GET', '/api/a', {});

    await expect(fake.fetch('https://hem.test/api/b', { method: 'DELETE' })).rejects.toThrow(
      'FakeFetch: unexpected request DELETE https://hem.test/api/b',
    );
    expect(fake.last.method).toBe('DELETE');
  });

  // verifies: REQ-TEST-001
  it('replies with an empty body, raw bytes, a Response, an Error or a computed reply', async () => {
    const failure = new TypeError('connection refused');
    const fake = new FakeFetch()
      .on('GET', '/empty', { status: 403 })
      .on('GET', '/bytes', { body: new Uint8Array([1, 2, 3]) })
      .on('GET', '/response', new Response('raw', { status: 202 }))
      .on('GET', '/error', failure)
      .on('POST', '/echo', (request) => ({ status: 201, body: { got: request.json() } }));

    const empty = await fake.fetch('https://hem.test/empty');
    expect([empty.status, await empty.text()]).toEqual([403, '']);
    expect(new Uint8Array(await (await fake.fetch('https://hem.test/bytes')).arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
    expect((await fake.fetch('https://hem.test/response')).status).toBe(202);
    await expect(fake.fetch('https://hem.test/error')).rejects.toBe(failure);
    const echo = await fake.fetch('https://hem.test/echo', { method: 'POST', body: '{"a":1}' });
    expect([echo.status, await echo.json()]).toEqual([201, { got: { a: 1 } }]);
  });

  // verifies: REQ-TEST-001
  it('records binary request bodies and no body for bodiless requests', async () => {
    const fake = new FakeFetch().always('PUT', '/upload', {}).always('GET', '/plain', {});

    await fake.fetch('https://hem.test/upload', { method: 'PUT', body: new Uint8Array([0, 255]) });
    expect(fake.last.body).toEqual(new Uint8Array([0, 255]));
    await fake.fetch('https://hem.test/plain');
    expect(fake.last.body).toBeUndefined();
    expect(fake.last.text()).toBeUndefined();
    expect(fake.last.json()).toBeUndefined();
  });

  // verifies: REQ-TEST-001
  it('keeps a hanging request open until its signal aborts, rejecting with the reason', async () => {
    const fake = new FakeFetch().on('GET', '/slow', 'hang');
    const controller = new AbortController();
    const reason = new Error('stop');

    const pending = fake.fetch('https://hem.test/slow', { signal: controller.signal });
    controller.abort(reason);

    await expect(pending).rejects.toBe(reason);
    expect(fake.last.signal).toBe(controller.signal);
  });

  // verifies: REQ-TEST-001
  it('delays a reply and lets the signal cut the delay short', async () => {
    const fake = new FakeFetch().on('GET', '/delayed', { delayMs: 5, body: 'late' }).on('GET', '/cut', { delayMs: 10_000 });

    expect(await (await fake.fetch('https://hem.test/delayed')).text()).toBe('late');
    await expect(fake.fetch('https://hem.test/cut', { signal: AbortSignal.timeout(5) })).rejects.toMatchObject({
      name: 'TimeoutError',
    });
  });

  // verifies: REQ-TEST-001
  it('rejects at once for a signal that is already aborted', async () => {
    const fake = new FakeFetch().on('GET', '/x', {});
    await expect(fake.fetch('https://hem.test/x', { signal: AbortSignal.abort() })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fake.pending).toHaveLength(1);
  });
});
