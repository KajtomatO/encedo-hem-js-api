import { describe, expect, it } from 'vitest';
import {
  HemClient,
  HemForbiddenError,
  HemOperationFailedError,
  HemProtocolError,
  HemTlsRequiredError,
  HemValidationError,
  KEY_TYPES,
  type KeyType,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { loginVector as v } from '../support/vectors.js';

const KID = '0123456789abcdef0123456789abcdef';

describe('keys.create', () => {
  // verifies: REQ-KEY-001
  it('posts {label, type} with scope keymgmt:gen and returns the key id', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: KID } });
    const kid = await loggedInClient(fake).keys.create({ label: 'root key', type: 'AES256' });

    expect(kid).toBe(KID);
    expect(loginScopes(fake)).toEqual(['keymgmt:gen']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.url.href).toBe('https://my.ence.do/api/keymgmt/create');
    expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
    expect(request?.headers['content-type']).toBe('application/json');
    expect(request?.text()).toBe('{"label":"root key","type":"AES256"}');
  }, 60_000);

  // verifies: REQ-KEY-001, REQ-API-004
  it('adds mode and descr (standard base64) when given', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: KID.toUpperCase() } });
    const kid = await loggedInClient(fake).keys.create({
      label: 'signer',
      type: 'SECP256R1',
      mode: 'ECDH,ExDSA',
      descr: Uint8Array.from([0xfb, 0xff, 0xbf, 0x00]),
    });
    expect(kid).toBe(KID);
    expect(operationRequests(fake)[0]?.json()).toEqual({ label: 'signer', type: 'SECP256R1', mode: 'ECDH,ExDSA', descr: '+/+/AA==' });
  }, 60_000);

  // verifies: REQ-KEY-001
  it.each(KEY_TYPES)('accepts type %s', async (type) => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: KID } });
    await loggedInClient(fake).keys.create({ label: 'k', type });
    expect((operationRequests(fake)[0]?.json() as { type: string }).type).toBe(type);
  }, 60_000);

  // verifies: REQ-KEY-001, REQ-API-005
  it.each([
    [{ label: 'k', type: 'AES512' }, 'type'],
    [{ label: 'k', type: 'aes256' }, 'type'],
    [{ label: 'k', type: 'SECP256R1', mode: 'ExDSA,ECDH' }, 'mode'],
    [{ label: 'k', type: 'SECP256R1', mode: 'ecdh' }, 'mode'],
    [{ label: '', type: 'AES256' }, 'label'],
    [{ label: 'x'.repeat(33), type: 'AES256' }, 'label'],
    [{ label: 'naïve', type: 'AES256' }, 'label'],
    [{ label: 'k', type: 'AES256', descr: new Uint8Array(65) }, 'descr'],
  ])('rejects %j with HemValidationError naming %s, without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).keys.create(params as { label: string; type: KeyType }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-API-005
  it('accepts a 32-character label and a 64-byte description', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: KID } });
    await loggedInClient(fake).keys.create({ label: 'L'.repeat(32), type: 'AES256', descr: new Uint8Array(64) });
    expect(operationRequests(fake)).toHaveLength(1);
  }, 60_000);

  it('rejects a reply without a valid key id', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: 'xyz' } });
    await expect(loggedInClient(fake).keys.create({ label: 'k', type: 'AES256' })).rejects.toThrow(HemProtocolError);
  }, 60_000);
});

describe('keys.get', () => {
  // verifies: REQ-KEY-002, REQ-AUTH-005, REQ-API-005
  it('uses scope keymgmt:use:<kid> with the key id in lower case, also when given in upper case', async () => {
    const fake = loginDevice().always('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 1700000000 } });
    const client = loggedInClient(fake);
    await client.keys.get(KID.toUpperCase());
    await client.keys.get(KID);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    const requests = operationRequests(fake);
    expect(requests.map((r) => r.url.href)).toEqual([`https://my.ence.do/api/keymgmt/get/${KID}`, `https://my.ence.do/api/keymgmt/get/${KID}`]);
    expect(requests[0]?.method).toBe('GET');
    expect(Object.keys(requests[0]?.headers ?? {})).toEqual(['authorization']);
    expect(requests[0]?.body).toBeUndefined();
  }, 60_000);

  // verifies: REQ-KEY-002, REQ-KEY-005
  it('returns updated, and type, pubkey, der and descr (bytes) when present', async () => {
    const fake = loginDevice()
      .on('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 1700000001 } }, { body: { updated: 7, type: 'SECP256R1', pubkey: 'AgEC', der: 'MAA=', descr: 'aGk=', extra: true } });
    const client = loggedInClient(fake);
    expect(await client.keys.get(KID)).toEqual({ updated: 1700000001 });
    expect(await client.keys.get(KID)).toEqual({
      updated: 7,
      type: { raw: 'SECP256R1', flags: [], algorithm: 'SECP256R1', unknown: [] },
      pubkey: Uint8Array.from([2, 1, 2]),
      der: Uint8Array.from([0x30, 0]),
      descr: Uint8Array.from([0x68, 0x69]),
    });
  }, 60_000);

  // verifies: REQ-KEY-002
  it('raises HemOperationFailedError for 406 (key not found)', async () => {
    const fake = loginDevice().on('GET', `/api/keymgmt/get/${KID}`, { status: 406 });
    await expect(loggedInClient(fake).keys.get(KID)).rejects.toThrow(HemOperationFailedError);
  }, 60_000);

  // verifies: REQ-API-005
  it.each(['', 'xyz', `${KID}0`, `${KID.slice(0, 31)}g`])('rejects key id %j with HemValidationError and no request', async (kid) => {
    const fake = loginDevice();
    await expect(loggedInClient(fake).keys.get(kid)).rejects.toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('key operations and roles', () => {
  // verifies: REQ-AUTH-010
  it('passes a master session’s 403 through as HemForbiddenError', async () => {
    const fake = loginDevice('M').on('POST', '/api/keymgmt/create', { status: 403 }).on('GET', `/api/keymgmt/get/${KID}`, { status: 403 });
    const client = loggedInClient(fake);
    await expect(client.keys.create({ label: 'k', type: 'AES256' })).rejects.toThrow(HemForbiddenError);
    await expect(client.keys.get(KID)).rejects.toThrow(HemForbiddenError);
    expect(client.auth.role).toEqual({ kind: 'master' });
  }, 60_000);
});

describe('key operations over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('raise HemTlsRequiredError with zero fetch calls, not even a login', async () => {
    const fake = new FakeFetch();
    const client = new HemClient({ url: 'http://192.168.7.1', fetch: fake.fetch, passphrase: v.passphrase, checkinRelay: null });
    await expect(client.keys.create({ label: 'k', type: 'AES256' })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.get(KID)).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
