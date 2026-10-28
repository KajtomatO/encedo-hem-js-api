// Audit log (M2): verification key, paged listing, verbatim download, and the mass-storage-only error mapping.
import { describe, expect, it } from 'vitest';
import { HemDeviceError, HemOperationFailedError, HemProtocolError, HemUnsupportedError, HemValidationError } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';

const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const KEY = bytes(32, 1);
const NONCE = bytes(32, 2);
const SIGNED = bytes(64, 3);

describe('logger.key', () => {
  // verifies: REQ-SYS-009, REQ-AUTH-005, REQ-API-004
  it('sends GET /api/logger/key with scope logger:get and returns key, nonce and nonce_signed as bytes', async () => {
    const fake = loginDevice().on('GET', '/api/logger/key', { body: { key: b64(KEY), nonce: b64(NONCE), nonce_signed: b64(SIGNED), extra: 1 } });
    const result = await loggedInClient(fake).logger.key();
    expect(result).toEqual({ key: KEY, nonce: NONCE, nonceSigned: SIGNED });
    expect(loginScopes(fake)).toEqual(['logger:get']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('GET');
    expect(request?.url.href).toBe('https://my.ence.do/api/logger/key');
    expect(Object.keys(request?.headers ?? {})).toEqual(['authorization']);
    expect(request?.body).toBeUndefined();
  });

  // verifies: REQ-SYS-009
  it('raises HemProtocolError when a field is missing', async () => {
    const fake = loginDevice().on('GET', '/api/logger/key', { body: { key: b64(KEY), nonce: b64(NONCE) } });
    await expect(loggedInClient(fake).logger.key()).rejects.toThrow(HemProtocolError);
  });
});

describe('logger.list', () => {
  // verifies: REQ-SYS-010, REQ-AUTH-005
  it('sends GET /api/logger/list without an offset and /list/{offset} with one, scope logger:get', async () => {
    const fake = loginDevice().always('GET', /^\/api\/logger\/list/, { body: { total: 3, id: ['0000a1b2', 'deadbeef'] } });
    const client = loggedInClient(fake);
    expect(await client.logger.list()).toEqual({ total: 3, ids: ['0000a1b2', 'deadbeef'] });
    expect(await client.logger.list({ offset: 0 })).toEqual({ total: 3, ids: ['0000a1b2', 'deadbeef'] });
    await client.logger.list({ offset: 128 });
    expect(loginScopes(fake)).toEqual(['logger:get']);
    expect(operationRequests(fake).map((r) => r.url.pathname)).toEqual(['/api/logger/list', '/api/logger/list/0', '/api/logger/list/128']);
    expect(operationRequests(fake).every((r) => r.method === 'GET' && r.body === undefined)).toBe(true);
  });

  // verifies: REQ-SYS-010
  it('accepts an empty page', async () => {
    const fake = loginDevice().on('GET', '/api/logger/list/5', { body: { total: 5, id: [] } });
    expect(await loggedInClient(fake).logger.list({ offset: 5 })).toEqual({ total: 5, ids: [] });
  });

  // verifies: REQ-SYS-010, REQ-API-005
  it.each([-1, 1.5, '3', Number.NaN])('refuses offset %j with HemValidationError and no request', async (offset) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).logger.list({ offset: offset as number }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('offset');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-SYS-010
  it.each([['0000A1B2'], ['0000a1b'], ['zzzzzzzz'], [7]])('raises HemProtocolError for an id that is not 8 lower-case hex characters: %j', async (id) => {
    const fake = loginDevice().on('GET', '/api/logger/list', { body: { total: 1, id: [id] } });
    await expect(loggedInClient(fake).logger.list()).rejects.toThrow(HemProtocolError);
  });

  // verifies: REQ-API-011
  it('raises HemUnsupportedError for a 404 (no mass-storage hardware), keeping the status and the cause', async () => {
    const fake = loginDevice().on('GET', '/api/logger/list', { status: 404 }).on('GET', '/api/logger/list/2', { status: 404 });
    const client = loggedInClient(fake);
    for (const call of [() => client.logger.list(), () => client.logger.list({ offset: 2 })]) {
      const error = await call().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HemUnsupportedError);
      expect((error as HemUnsupportedError).status).toBe(404);
      expect((error as HemUnsupportedError).message).toMatch(/mass-storage hardware/);
      expect((error as HemUnsupportedError).cause).toBeInstanceOf(HemDeviceError);
    }
  });
});

describe('logger.download', () => {
  const CONTENT = new TextEncoder().encode('0000a1b2|1|boot|…\n0000a1b2|2|login|…\n');

  // verifies: REQ-SYS-011, REQ-AUTH-005
  it('sends GET /api/logger/{file} with the id in lower case and scope logger:get', async () => {
    const fake = loginDevice().on('GET', '/api/logger/0000a1b2', { body: CONTENT, headers: { 'content-type': 'text/plain' } });
    const file = await loggedInClient(fake).logger.download('0000A1B2');
    expect(file.id).toBe('0000a1b2');
    expect(loginScopes(fake)).toEqual(['logger:get']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('GET');
    expect(request?.url.href).toBe('https://my.ence.do/api/logger/0000a1b2');
    expect(Object.keys(request?.headers ?? {})).toEqual(['authorization']);
  });

  // verifies: REQ-SYS-011
  it('returns the body bytes unmodified, a text view, and the content type', async () => {
    const raw = Uint8Array.from([0x30, 0x7c, 0xff, 0x0a, 0x00, 0x7c]); // not valid UTF-8, not JSON: returned as is
    const fake = loginDevice()
      .on('GET', '/api/logger/0000a1b2', { body: CONTENT, headers: { 'content-type': 'text/plain' } })
      .on('GET', '/api/logger/0000a1b3', { body: raw });
    const client = loggedInClient(fake);
    const text = await client.logger.download('0000a1b2');
    expect(text.bytes).toEqual(CONTENT);
    expect(text.text()).toBe('0000a1b2|1|boot|…\n0000a1b2|2|login|…\n');
    expect(text.contentType).toBe('text/plain');
    const binary = await client.logger.download('0000a1b3');
    expect(binary.bytes).toEqual(raw);
    expect(binary.contentType).toBeUndefined();
  });

  // verifies: REQ-SYS-011
  it('returns an empty file as empty bytes', async () => {
    const fake = loginDevice().on('GET', '/api/logger/0000a1b2', { status: 200 });
    const file = await loggedInClient(fake).logger.download('0000a1b2');
    expect(file.bytes).toEqual(new Uint8Array());
    expect(file.text()).toBe('');
  });

  // verifies: REQ-SYS-011, REQ-API-005
  it.each(['', '0000a1b', '0000a1b20', 'zzzzzzzz', '../key', 7])('refuses file id %j with HemValidationError and no request', async (id) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).logger.download(id as string).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('file');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-SYS-011
  it('raises HemOperationFailedError for 406 (file currently being written)', async () => {
    const fake = loginDevice().on('GET', '/api/logger/0000a1b2', { status: 406 });
    await expect(loggedInClient(fake).logger.download('0000a1b2')).rejects.toThrow(HemOperationFailedError);
  });

  // verifies: REQ-API-011
  it('raises HemUnsupportedError for a 404 whose message names both causes', async () => {
    const fake = loginDevice().on('GET', '/api/logger/0000a1b2', { status: 404 });
    const error = await loggedInClient(fake).logger.download('0000a1b2').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemUnsupportedError);
    expect((error as HemUnsupportedError).message).toMatch(/mass-storage hardware/);
    expect((error as HemUnsupportedError).message).toMatch(/no log file with this id/);
    expect((error as HemUnsupportedError).status).toBe(404);
  });
});

describe('mass-storage-only mapping', () => {
  // verifies: REQ-API-011
  it('leaves a 404 of an operation that exists on every build alone', async () => {
    const fake = loginDevice().on('GET', '/api/logger/key', { status: 404 });
    const error = await loggedInClient(fake).logger.key().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemDeviceError);
    expect(error).not.toBeInstanceOf(HemUnsupportedError);
  });

  // verifies: REQ-SYS-010, REQ-SYS-011
  it('is sent over an http: device URL (the logger operations are not TLS-only)', async () => {
    const fake = loginDevice().on('GET', '/api/logger/list', { body: { total: 0, id: [] } });
    await loggedInClient(fake, { url: 'http://192.168.7.1' }).logger.list();
    expect(operationRequests(fake)[0]?.url.href).toBe('http://192.168.7.1/api/logger/list');
  });
});
