// The Node.js device transport, against local servers on the loopback address:
// header spelling, one connection per request, error classes, and the TLS
// trust options of createNodeFetch with the self-signed fixture certificate.
import { readFileSync } from 'node:fs';
import { type IncomingMessage, type Server, type ServerResponse, createServer } from 'node:http';
import { createServer as createTlsServer } from 'node:https';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { HemAbortError, HemDeviceError, HemTimeoutError, HemUnreachableError, createNodeFetch } from '../../src/index.js';
import { isNode } from '../../src/transport/node-https.js';
import { Transport, type TransportRequest } from '../../src/transport/transport.js';

const fixture = (name: string): Buffer => readFileSync(new URL(`../fixtures/tls/${name}`, import.meta.url));
const CERT = fixture('cert.pem');
const KEY = fixture('key.pem');

interface Seen {
  method: string;
  url: string;
  /** Header names exactly as they arrived (even indices of `rawHeaders`). */
  names: string[];
  headers: Record<string, string>;
  remotePort: number;
  body: Buffer;
}

const seen: Seen[] = [];

function handle(req: IncomingMessage, res: ServerResponse): void {
  const chunks: Buffer[] = [];
  req.on('data', (chunk: Buffer) => chunks.push(chunk));
  req.on('end', () => {
    const names = req.rawHeaders.filter((_, i) => i % 2 === 0);
    seen.push({ method: req.method ?? '', url: req.url ?? '', names, headers: req.headers as Record<string, string>, remotePort: req.socket.remotePort ?? 0, body: Buffer.concat(chunks) });
    switch (req.url) {
      case '/api/slow':
        setTimeout(() => res.end('{}'), 300);
        return;
      case '/api/redirect':
        res.writeHead(302, { Location: '/api/elsewhere' }).end();
        return;
      case '/api/odd':
        res.statusCode = 795;
        res.end();
        return;
      case '/api/fail':
        res.writeHead(500, { 'Content-Type': 'text/plain' }).end('device says no');
        return;
      default:
        res.writeHead(200, { 'Content-Type': 'application/json', 'X-Multi': ['a', 'b'] }).end('{"ok":true}');
    }
  });
}

const get = (path = '/api/system/status', extra: Partial<TransportRequest> = {}): TransportRequest => ({ operation: 'test.op', method: 'GET', path, ...extra });

let plain: Server;
let tls: Server;
let plainUrl: string;
let tlsUrl: string;

beforeAll(async () => {
  plain = createServer(handle);
  tls = createTlsServer({ key: KEY, cert: CERT }, handle);
  await Promise.all([
    new Promise<void>((resolve) => plain.listen(0, '127.0.0.1', resolve)),
    new Promise<void>((resolve) => tls.listen(0, '127.0.0.1', resolve)),
  ]);
  plainUrl = `http://127.0.0.1:${(plain.address() as AddressInfo).port}`;
  tlsUrl = `https://127.0.0.1:${(tls.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await Promise.all([new Promise((resolve) => plain.close(resolve)), new Promise((resolve) => tls.close(resolve))]);
});

afterEach(() => {
  seen.length = 0;
  vi.unstubAllGlobals();
});

describe('the Node transport without a supplied fetch', () => {
  it('runs on Node', () => {
    expect(isNode()).toBe(true);
  });

  // verifies: REQ-NET-013, REQ-NET-009
  it('spells Content-Type, Content-Length and Authorization exactly, counts the body in bytes, and sends no transfer-encoding', async () => {
    const body = '{"label":"café"}';
    await new Transport({ url: plainUrl }).send({ operation: 'test.op', method: 'POST', path: '/api/keymgmt/create', body, bearer: 't' });

    const [request] = seen;
    expect(request?.method).toBe('POST');
    expect(request?.names).toEqual(expect.arrayContaining(['Host', 'Content-Type', 'Authorization', 'Content-Length']));
    expect(request?.names.map((name) => name.toLowerCase())).not.toContain('transfer-encoding');
    for (const name of request?.names ?? []) expect(name, name).not.toMatch(/^(content-type|content-length|authorization)$/);
    expect(request?.headers['content-length']).toBe(String(new TextEncoder().encode(body).byteLength));
    expect(request?.body.toString('utf8')).toBe(body);
  });

  // verifies: REQ-NET-013
  it('opens a new connection for every request', async () => {
    const transport = new Transport({ url: plainUrl });
    await transport.send(get());
    await transport.send(get());
    await transport.send(get());
    const ports = seen.map((request) => request.remotePort);
    expect(new Set(ports).size).toBe(3);
  });

  // verifies: REQ-NET-001
  it('never calls the global fetch, and needs none to be constructed', async () => {
    vi.stubGlobal('fetch', undefined);
    const transport = new Transport({ url: plainUrl });
    const spy = vi.fn(() => Promise.reject(new Error('global fetch must not be called')));
    vi.stubGlobal('fetch', spy);
    const response = await transport.send(get());
    expect(response.text()).toBe('{"ok":true}');
    expect(spy).not.toHaveBeenCalled();
  });

  // verifies: REQ-NET-013, REQ-NET-006
  it('maps a refused connection to HemUnreachableError', async () => {
    await expect(new Transport({ url: 'http://127.0.0.1:1' }).send(get())).rejects.toThrow(HemUnreachableError);
  });

  // verifies: REQ-NET-013, REQ-NET-004
  it('honours the time limit', async () => {
    await expect(new Transport({ url: plainUrl, timeoutMs: 50 }).send(get('/api/slow'))).rejects.toThrow(HemTimeoutError);
  });

  // verifies: REQ-NET-013, REQ-NET-005
  it("honours the caller's signal", async () => {
    const controller = new AbortController();
    const pending = new Transport({ url: plainUrl }).send(get('/api/slow', { signal: controller.signal }));
    setTimeout(() => controller.abort(), 10);
    await expect(pending).rejects.toThrow(HemAbortError);
  });

  // verifies: REQ-NET-013, REQ-NET-010
  it('does not follow redirects', async () => {
    await expect(new Transport({ url: plainUrl }).send(get('/api/redirect'))).rejects.toThrow(/redirect/);
    // A late record of the previous test's aborted request may still arrive; only this test's paths matter.
    const urls = seen.map((request) => request.url).filter((url) => url !== '/api/slow');
    expect(urls).toEqual(['/api/redirect']);
  });

  // verifies: REQ-NET-013
  it('passes a status outside 200–599 through unchanged', async () => {
    const error = await new Transport({ url: plainUrl }).send(get('/api/odd')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemDeviceError);
    expect((error as HemDeviceError).status).toBe(795);
  });

  // verifies: REQ-NET-013, REQ-NET-006
  it('maps an error status with its body, and exposes response headers including repeated ones', async () => {
    const error = await new Transport({ url: plainUrl }).send(get('/api/fail')).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemDeviceError);
    expect((error as HemDeviceError).bodyText).toBe('device says no');
    const response = await new Transport({ url: plainUrl }).send(get());
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.get('x-multi')).toBe('a, b');
  });
});

describe('createNodeFetch and TLS trust', () => {
  // verifies: REQ-NET-013, REQ-NET-001
  it('reaches a server with a private certificate only when that certificate is trusted', async () => {
    await expect(new Transport({ url: tlsUrl }).send(get())).rejects.toThrow(HemUnreachableError);
    const trusted = new Transport({ url: tlsUrl, fetch: createNodeFetch({ ca: CERT }) });
    expect((await trusted.send(get())).text()).toBe('{"ok":true}');
  });

  // verifies: REQ-NET-013
  it('accepts any certificate with rejectUnauthorized: false', async () => {
    const lab = new Transport({ url: tlsUrl, fetch: createNodeFetch({ rejectUnauthorized: false }) });
    expect((await lab.send(get())).status).toBe(200);
  });

  // verifies: REQ-NET-013
  it('checks the certificate against servername', async () => {
    const right = new Transport({ url: tlsUrl, fetch: createNodeFetch({ ca: CERT, servername: 'my.ence.do' }) });
    expect((await right.send(get())).status).toBe(200);
    const wrong = new Transport({ url: tlsUrl, fetch: createNodeFetch({ ca: CERT, servername: 'wrong.example' }) });
    await expect(wrong.send(get())).rejects.toThrow(HemUnreachableError);
  });

  // verifies: REQ-NET-013
  it('spells the headers the same way through createNodeFetch', async () => {
    await new Transport({ url: plainUrl, fetch: createNodeFetch() }).send({ operation: 'test.op', method: 'POST', path: '/api/x', body: '{}', bearer: 't' });
    expect(seen[0]?.names).toEqual(expect.arrayContaining(['Content-Type', 'Content-Length', 'Authorization']));
  });
});
