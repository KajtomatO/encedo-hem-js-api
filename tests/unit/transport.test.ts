import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  HemBadRequestError,
  HemDeviceError,
  HemTlsRequiredError,
  HemUnsupportedError,
  HemValidationError,
} from '../../src/errors.js';
import { isNode } from '../../src/transport/node-https.js';
import { Transport, type TransportRequest } from '../../src/transport/transport.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { blockedFetch } from '../support/setup.js';

const get = (path = '/api/system/status', extra: Partial<TransportRequest> = {}): TransportRequest => ({
  operation: 'test.op',
  method: 'GET',
  path,
  ...extra,
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetch injection', () => {
  // verifies: REQ-NET-001
  it('uses the supplied fetch and never the global one', async () => {
    const globalSpy = vi.fn(() => Promise.reject(new Error('global fetch must not be called')));
    vi.stubGlobal('fetch', globalSpy);
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: {} });

    await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get());

    expect(fake.requests).toHaveLength(1);
    expect(globalSpy).not.toHaveBeenCalled();
  });

  // verifies: REQ-NET-001 — in a browser; on Node the fallback is the Node transport (tests/unit/node-transport.node.test.ts).
  it.skipIf(isNode())('falls back to the global fetch when none is supplied, in a browser', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: {} });
    vi.stubGlobal('fetch', fake.fetch);

    const transport = new Transport({ url: 'https://hem.test' });
    vi.stubGlobal('fetch', blockedFetch);
    await transport.send(get());

    expect(fake.requests).toHaveLength(1);
  });

  // verifies: REQ-NET-001
  it.skipIf(isNode())('throws HemUnsupportedError at construction when there is no fetch at all, in a browser', () => {
    vi.stubGlobal('fetch', undefined);
    expect(() => new Transport({ url: 'https://hem.test' })).toThrow(HemUnsupportedError);
  });

  // verifies: REQ-NET-001
  it('calls the supplied function with exactly (url, init)', async () => {
    const calls: unknown[][] = [];
    const fetchSpy = (...args: unknown[]): Promise<Response> => {
      calls.push(args);
      return Promise.resolve(new Response('{}'));
    };
    await new Transport({ url: 'https://hem.test', fetch: fetchSpy }).send(get('/api/system/version'));

    expect(calls).toHaveLength(1);
    const [url, init, ...rest] = calls[0] as [unknown, RequestInit, ...unknown[]];
    expect(rest).toEqual([]);
    expect(url).toBe('https://hem.test/api/system/version');
    expect(typeof init).toBe('object');
    expect(init.method).toBe('GET');
  });
});

describe('device URL', () => {
  // verifies: REQ-NET-002
  it.each([
    ['https://my.ence.do', 'https://my.ence.do/api/system/status'],
    ['https://192.168.7.1', 'https://192.168.7.1/api/system/status'],
    ['http://192.168.7.1', 'http://192.168.7.1/api/system/status'],
    ['https://my.ence.do:8443', 'https://my.ence.do:8443/api/system/status'],
    ['https://[fe80::1]', 'https://[fe80::1]/api/system/status'],
    ['https://[2001:db8::7]:4443/', 'https://[2001:db8::7]:4443/api/system/status'],
    ['https://my.ence.do/', 'https://my.ence.do/api/system/status'],
    ['https://gw.example/hem', 'https://gw.example/hem/api/system/status'],
    ['https://gw.example/hem/', 'https://gw.example/hem/api/system/status'],
    ['https://gw.example/a/b//', 'https://gw.example/a/b/api/system/status'],
    [new URL('https://my.ence.do/hem/'), 'https://my.ence.do/hem/api/system/status'],
    [new URL('http://[fe80::1]:8080'), 'http://[fe80::1]:8080/api/system/status'],
  ] as [string | URL, string][])('sends a request for %s to %s', async (base, expected) => {
    const fake = new FakeFetch().always('GET', /status/, { body: {} });
    await new Transport({ url: base, fetch: fake.fetch }).send(get());
    expect(fake.last.url.href).toBe(expected);
  });

  // verifies: REQ-NET-002
  it.each(['https://user@my.ence.do', 'https://user:pass@my.ence.do', 'https://:pass@192.168.7.1'])(
    'rejects %s, which carries credentials, with HemValidationError',
    (url) => {
      const error = (() => {
        try {
          new Transport({ url, fetch: new FakeFetch().fetch });
        } catch (caught) {
          return caught;
        }
        return undefined;
      })();
      expect(error).toBeInstanceOf(HemValidationError);
      expect((error as HemValidationError).parameter).toBe('url');
      expect((error as Error).message).not.toContain('pass');
    },
  );

  it.each(['', 'my.ence.do', 'ftp://my.ence.do', 'https://my.ence.do/?x=1', 'https://my.ence.do/#x', 'not a url'])('rejects %j', (url) => {
    expect(() => new Transport({ url, fetch: new FakeFetch().fetch })).toThrow(HemValidationError);
  });
});

describe('HTTPS guard', () => {
  // verifies: REQ-NET-003
  it('refuses a TLS-only request on an http: device URL without calling fetch', async () => {
    const fake = new FakeFetch();
    const transport = new Transport({ url: 'http://192.168.7.1', fetch: fake.fetch });
    await expect(transport.send(get('/api/keymgmt/list', { tlsOnly: true }))).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-NET-003
  it('sends an unflagged request on http:, and a TLS-only one on https:', async () => {
    const fake = new FakeFetch().always('GET', /./, { body: {} });
    await new Transport({ url: 'http://192.168.7.1', fetch: fake.fetch }).send(get());
    await new Transport({ url: 'https://192.168.7.1', fetch: fake.fetch }).send(get('/api/keymgmt/list', { tlsOnly: true }));
    expect(fake.requests.map((request) => request.url.href)).toEqual([
      'http://192.168.7.1/api/system/status',
      'https://192.168.7.1/api/keymgmt/list',
    ]);
  });

  // verifies: REQ-NET-003
  it('maps a 418 response to HemTlsRequiredError', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { status: 418 });
    const error = await new Transport({ url: 'http://192.168.7.1', fetch: fake.fetch }).send(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemTlsRequiredError);
    expect((error as HemTlsRequiredError).status).toBe(418);
  });
});

describe('headers', () => {
  // verifies: REQ-NET-009
  it('sends no header for a bodiless, unauthenticated request', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: {} });
    await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get());
    expect(fake.last.headers).toEqual({});
  });

  // verifies: REQ-NET-009
  it('sends Content-Type only with a body and Authorization only with a bearer', async () => {
    const fake = new FakeFetch().always('POST', /./, { body: {} });
    const transport = new Transport({ url: 'https://hem.test', fetch: fake.fetch });

    await transport.send({ operation: 'a', method: 'POST', path: '/api/auth/token', body: '{"auth":"x"}' });
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(fake.last.text()).toBe('{"auth":"x"}');

    await transport.send({ operation: 'b', method: 'POST', path: '/api/crypto/hmac/hash', body: '{}', bearer: 'tok' });
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json', authorization: 'Bearer tok' });
  });

  // verifies: REQ-NET-009
  it('sends Content-Disposition only for uploads', async () => {
    const fake = new FakeFetch().always('POST', /./, { body: {} });
    await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send({
      operation: 'upload',
      method: 'POST',
      path: '/api/system/upgrade/upload_fw',
      body: new Uint8Array([1, 2]),
      bearer: 't',
      contentDisposition: 'attachment; filename="fw.bin"',
    });
    expect(Object.keys(fake.last.headers).sort()).toEqual(['authorization', 'content-disposition', 'content-type']);
    expect(fake.last.body).toEqual(new Uint8Array([1, 2]));
  });
});

describe('redirects', () => {
  // verifies: REQ-NET-010
  it('asks fetch not to follow redirects', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: {} });
    await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get());
    expect(fake.last.redirect).toBe('manual');
  });

  // verifies: REQ-NET-010
  it.each([301, 302, 303, 307, 308])('raises HemDeviceError for a %i redirect and makes no second request', async (status) => {
    const fake = new FakeFetch().always('GET', /./, { status, headers: { location: 'https://evil.test/steal' } });
    const error = await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemDeviceError);
    expect((error as HemDeviceError).status).toBe(status);
    expect(fake.requests).toHaveLength(1);
  });

  // verifies: REQ-NET-010
  it('raises HemDeviceError for an opaque redirect response (what browsers return)', async () => {
    const opaque = new Response(null, { status: 200 });
    Object.defineProperty(opaque, 'type', { value: 'opaqueredirect' });
    Object.defineProperty(opaque, 'status', { value: 0 });
    const fake = new FakeFetch().on('GET', '/api/system/status', opaque);
    const error = await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemDeviceError);
    expect((error as HemDeviceError).status).toBeUndefined();
    expect(fake.requests).toHaveLength(1);
  });
});

describe('responses', () => {
  it('returns a 2xx response with its body read', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/version', { body: { hwv: 'x' } });
    const response = await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get('/api/system/version'));
    expect(response.status).toBe(200);
    expect(JSON.parse(response.text())).toEqual({ hwv: 'x' });
  });

  it('maps an error status through the error table, with the body attached', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { status: 400, body: 'bad' });
    const error = await new Transport({ url: 'https://hem.test', fetch: fake.fetch }).send(get()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemBadRequestError);
    expect((error as HemBadRequestError).bodyText).toBe('bad');
    expect((error as HemBadRequestError).operation).toBe('test.op');
  });
});
