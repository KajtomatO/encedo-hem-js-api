import { describe, expect, it } from 'vitest';
import { HemClient, HemProtocolError, HemTlsRequiredError, HemValidationError } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { loginVector as v } from '../support/vectors.js';

const kid = (n: number): string => n.toString(16).padStart(32, '0');
const record = (n: number, descr?: string) => ({
  kid: kid(n),
  created: 1700000000 + n,
  type: 'PKEY,ECDH,ExDSA,SECP256R1',
  label: `key ${n}`,
  updated: 1700000100 + n,
  ...(descr === undefined ? {} : { descr }),
});
const envelope = (offset: number, total: number, list: unknown[], deleted = 0) => ({ offset, deleted, total, listed: list.length, list });

describe('keys.list', () => {
  // verifies: REQ-KEY-004
  it('maps a page: offset, total, listed and each key with kid, type, label, created, updated and descr (bytes)', async () => {
    const fake = loginDevice().on('GET', '/api/keymgmt/list', { body: { ...envelope(0, 2, [record(1, 'AQID'), record(2)], 1), future: 1 } });
    const page = await loggedInClient(fake).keys.list();
    expect(page).toEqual({
      offset: 0,
      total: 2,
      listed: 2,
      deleted: 1,
      keys: [
        {
          kid: kid(1),
          type: { raw: 'PKEY,ECDH,ExDSA,SECP256R1', flags: ['PKEY', 'ECDH', 'ExDSA'], algorithm: 'SECP256R1', unknown: [] },
          label: 'key 1',
          created: 1700000001,
          updated: 1700000101,
          descr: Uint8Array.from([1, 2, 3]),
        },
        {
          kid: kid(2),
          type: { raw: 'PKEY,ECDH,ExDSA,SECP256R1', flags: ['PKEY', 'ECDH', 'ExDSA'], algorithm: 'SECP256R1', unknown: [] },
          label: 'key 2',
          created: 1700000002,
          updated: 1700000102,
        },
      ],
    });
    expect(loginScopes(fake)).toEqual(['keymgmt:list']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('GET');
    expect(Object.keys(request?.headers ?? {})).toEqual(['authorization']);
    expect(request?.body).toBeUndefined();
  }, 60_000);

  // verifies: REQ-KEY-004
  it('chooses the path from the parameters, for any offset and any count from 1 to 15', async () => {
    const fake = loginDevice().always('GET', /^\/api\/keymgmt\/list/, { body: envelope(0, 0, []) });
    const client = loggedInClient(fake);
    await client.keys.list();
    await client.keys.list({ offset: 0 });
    await client.keys.list({ offset: 30 });
    for (let count = 1; count <= 15; count += 1) await client.keys.list({ offset: 7, count });
    await client.keys.list({ count: 5 });
    const paths = operationRequests(fake).map((r) => r.path);
    expect(paths.slice(0, 3)).toEqual(['/api/keymgmt/list', '/api/keymgmt/list/0', '/api/keymgmt/list/30']);
    expect(paths.slice(3, 18)).toEqual(Array.from({ length: 15 }, (_, i) => `/api/keymgmt/list/7/${i + 1}`));
    expect(paths[18]).toBe('/api/keymgmt/list/0/5');
    expect(loginScopes(fake)).toEqual(['keymgmt:list']);
  }, 60_000);

  // verifies: REQ-KEY-004
  it.each([{ count: 16 }, { count: 0 }, { count: 2.5 }, { offset: -1 }, { offset: 1.5 }, { offset: Number.NaN }])(
    'rejects %j with HemValidationError and no request',
    async (params) => {
      const fake = loginDevice();
      await expect(loggedInClient(fake).keys.list(params)).rejects.toThrow(HemValidationError);
      expect(fake.requests).toHaveLength(0);
    },
  );

  it('rejects a page whose entry lacks a required field', async () => {
    const { label: _, ...noLabel } = record(1);
    const fake = loginDevice().on('GET', '/api/keymgmt/list', { body: envelope(0, 1, [noLabel]) });
    await expect(loggedInClient(fake).keys.list()).rejects.toThrow(/list\[0\]\.label/);
    expect(HemProtocolError).toBeDefined();
  }, 60_000);
});

describe('keys.listAll', () => {
  // verifies: REQ-KEY-004
  it('walks the pages until the offset reaches total, continuing past a short page', async () => {
    const fake = loginDevice()
      .on('GET', '/api/keymgmt/list/0/15', { body: envelope(0, 20, Array.from({ length: 15 }, (_, i) => record(i))) })
      // A short page (deleted records skipped) that does not end the walk.
      .on('GET', '/api/keymgmt/list/15/15', { body: envelope(15, 20, [record(15), record(16)], 3) })
      .on('GET', '/api/keymgmt/list/17/15', { body: envelope(17, 20, [record(17), record(18), record(19)]) });
    const keys = await loggedInClient(fake).keys.listAll();
    expect(keys.map((key) => key.kid)).toEqual(Array.from({ length: 20 }, (_, i) => kid(i)));
    expect(operationRequests(fake).map((r) => r.path)).toEqual(['/api/keymgmt/list/0/15', '/api/keymgmt/list/15/15', '/api/keymgmt/list/17/15']);
  }, 60_000);

  // verifies: REQ-KEY-004
  it('stops at an empty page even when total says more', async () => {
    const fake = loginDevice()
      .on('GET', '/api/keymgmt/list/0/15', { body: envelope(0, 9, [record(1)]) })
      .on('GET', '/api/keymgmt/list/1/15', { body: envelope(1, 9, []) });
    expect((await loggedInClient(fake).keys.listAll()).map((k) => k.kid)).toEqual([kid(1)]);
  }, 60_000);

  it('makes one request for an empty repository', async () => {
    const fake = loginDevice().on('GET', '/api/keymgmt/list/0/15', { body: envelope(0, 0, []) });
    expect(await loggedInClient(fake).keys.listAll()).toEqual([]);
  }, 60_000);
});

describe('keys.search', () => {
  // verifies: REQ-KEY-003
  it('posts {descr} with scope keymgmt:search and maps the page', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/search', { body: envelope(0, 1, [record(4, 'AQIDBA==')]) });
    const page = await loggedInClient(fake).keys.search({ descr: Uint8Array.from([1, 2, 3, 4]) });
    expect(page.total).toBe(1);
    expect(page.keys.map((k) => [k.kid, k.label])).toEqual([[kid(4), 'key 4']]);
    expect(loginScopes(fake)).toEqual(['keymgmt:search']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.path).toBe('/api/keymgmt/search');
    expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
    expect(request?.text()).toBe('{"descr":"AQIDBA=="}');
  }, 60_000);

  // verifies: REQ-KEY-003
  it('sends prefix, suffix and contains needles as base64 with ^, $ or neither, plus offset and limit when given', async () => {
    const fake = loginDevice().always('POST', '/api/keymgmt/search', { body: envelope(0, 0, []) });
    const client = loggedInClient(fake);
    const descr = Uint8Array.from([0xfb, 0xff]);
    await client.keys.search({ descr, match: 'prefix' });
    await client.keys.search({ descr, match: 'suffix', offset: 15, limit: 5 });
    await client.keys.search({ descr, match: 'contains', offset: 0 });
    expect(operationRequests(fake).map((r) => r.json())).toEqual([
      { descr: '^+/8=' },
      { descr: '+/8=$', offset: 15, limit: 5 },
      { descr: '+/8=', offset: 0 },
    ]);
  }, 60_000);

  // verifies: REQ-KEY-003
  it.each([
    [{ descr: new Uint8Array(65) }, 'descr'],
    [{ descr: new Uint8Array(0) }, 'descr'],
    [{ descr: new Uint8Array(1), limit: 16 }, 'limit'],
    [{ descr: new Uint8Array(1), offset: -1 }, 'offset'],
    [{ descr: new Uint8Array(1), match: 'exact' }, 'match'],
  ])('rejects %j with HemValidationError naming %s and no request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).keys.search(params as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-KEY-003
  it('accepts a 64-byte needle', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/search', { body: envelope(0, 0, []) });
    await loggedInClient(fake).keys.search({ descr: new Uint8Array(64) });
    expect(operationRequests(fake)).toHaveLength(1);
  }, 60_000);

  // verifies: REQ-KEY-003
  it('gives an empty result for a 200 with an empty list and for a 404', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/search', { body: envelope(0, 0, []) }, { status: 404 });
    const client = loggedInClient(fake);
    const empty = { offset: 0, total: 0, listed: 0, deleted: 0, keys: [] };
    expect(await client.keys.search({ descr: Uint8Array.from([1]) })).toEqual(empty);
    expect(await client.keys.search({ descr: Uint8Array.from([1]) })).toEqual(empty);
  }, 60_000);

  it('does not map a 404 of another operation to an empty result', async () => {
    const fake = loginDevice().on('GET', '/api/keymgmt/list', { status: 404 });
    await expect(loggedInClient(fake).keys.list()).rejects.toMatchObject({ status: 404 });
  }, 60_000);
});

describe('keys.findByDescription', () => {
  // verifies: REQ-KEY-003
  it('searches by prefix across pages and keeps only exact matches', async () => {
    const wanted = Uint8Array.from([0x6f, 0x6d, 0x3a, 0x72, 0x6f, 0x6f, 0x74]); // "om:root"
    const exact = 'b206cm9vdA=='; // base64 of "om:root"
    const longer = 'b206cm9vdDI='; // "om:root2"
    const fake = loginDevice()
      .on('POST', '/api/keymgmt/search', { body: envelope(0, 17, [...Array.from({ length: 14 }, (_, i) => record(i, longer)), record(14, exact)]) })
      .on('POST', '/api/keymgmt/search', { body: envelope(15, 17, [record(15, longer), record(16, exact)]) });
    const found = await loggedInClient(fake).keys.findByDescription(wanted);
    expect(found.map((k) => k.kid)).toEqual([kid(14), kid(16)]);
    expect(operationRequests(fake).map((r) => r.json())).toEqual([
      { descr: '^b206cm9vdA==', offset: 0, limit: 15 },
      { descr: '^b206cm9vdA==', offset: 15, limit: 15 },
    ]);
  }, 60_000);
});

describe('list and search over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('raise HemTlsRequiredError with zero fetch calls', async () => {
    const fake = new FakeFetch();
    const client = new HemClient({ url: 'http://192.168.7.1', fetch: fake.fetch, passphrase: v.passphrase, checkinRelay: null });
    await expect(client.keys.list()).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.listAll()).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.search({ descr: Uint8Array.from([1]) })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.findByDescription(Uint8Array.from([1]))).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
