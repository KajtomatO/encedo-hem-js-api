import { describe, expect, it } from 'vitest';
import { HemClient, HemOperationFailedError, HemTlsRequiredError, HemValidationError, type WrapParams } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { loginVector as v } from '../support/vectors.js';

const KID = '00112233445566778899aabbccddeeff';
const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));

function expectJsonPost(fake: FakeFetch, path: string): Record<string, unknown> {
  const [request] = operationRequests(fake);
  expect(request?.method).toBe('POST');
  expect(request?.url.href).toBe(`https://my.ence.do${path}`);
  expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
  expect(request?.headers['content-type']).toBe('application/json');
  return request?.json() as Record<string, unknown>;
}

describe('crypto.hmac', () => {
  // verifies: REQ-OPS-001, REQ-AUTH-005
  it('posts {kid, msg} in base64 without alg, with scope keymgmt:use:<kid>, and returns the MAC bytes', async () => {
    const mac = bytes(32, 7);
    const fake = loginDevice().on('POST', '/api/crypto/hmac/hash', { body: { mac: b64(mac) } });
    const result = await loggedInClient(fake).crypto.hmac({ kid: KID.toUpperCase(), msg: Uint8Array.from([1, 2, 3]) });
    expect(result).toEqual(mac);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/hmac/hash')).toEqual({ kid: KID, msg: 'AQID' });
  }, 60_000);

  // verifies: REQ-OPS-001, REQ-API-005
  it.each([0, 2049])('rejects a %i-byte message with HemValidationError and no request', async (length) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.hmac({ kid: KID, msg: bytes(length) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('msg');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-001, REQ-API-005
  it('accepts a 2048-byte message', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/hash', { body: { mac: 'AA==' } });
    await loggedInClient(fake).crypto.hmac({ kid: KID, msg: bytes(2048) });
    expect(operationRequests(fake)).toHaveLength(1);
  }, 60_000);

  // verifies: REQ-OPS-001
  it('raises HemOperationFailedError for a 406', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/hash', { status: 406 });
    await expect(loggedInClient(fake).crypto.hmac({ kid: KID, msg: bytes(1) })).rejects.toThrow(HemOperationFailedError);
  }, 60_000);
});

describe('crypto.wrap', () => {
  // verifies: REQ-OPS-002, REQ-AUTH-005
  it('posts {kid, msg} with scope keymgmt:use:<kid> and returns the wrapped bytes', async () => {
    const wrapped = bytes(40, 9);
    const fake = loginDevice().on('POST', '/api/crypto/cipher/wrap', { body: { wrapped: b64(wrapped) } });
    const result = await loggedInClient(fake).crypto.wrap({ kid: KID, msg: bytes(32) });
    expect(result).toEqual(wrapped);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/cipher/wrap')).toEqual({ kid: KID, msg: b64(bytes(32)) });
  }, 60_000);

  // verifies: REQ-OPS-002
  it.each(['AES128', 'AES192', 'AES256'] as const)('adds alg %s and iv when given', async (alg) => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/wrap', { body: { wrapped: 'AA==' } });
    await loggedInClient(fake).crypto.wrap({ kid: KID, msg: bytes(16), alg, iv: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]) });
    expect(expectJsonPost(fake, '/api/crypto/cipher/wrap')).toEqual({ kid: KID, msg: b64(bytes(16)), alg, iv: 'AQIDBAUGBwg=' });
  }, 60_000);

  // verifies: REQ-OPS-002
  it.each([
    [{ msg: bytes(20) }, 'msg'],
    [{ msg: bytes(8) }, 'msg'],
    [{ msg: bytes(0) }, 'msg'],
    [{ msg: bytes(2056) }, 'msg'],
    [{ msg: bytes(16), iv: bytes(7) }, 'iv'],
    [{ msg: bytes(16), iv: bytes(16) }, 'iv'],
    [{ msg: bytes(16), alg: 'AES512' }, 'alg'],
  ])('rejects %j with HemValidationError naming %s and no request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.wrap({ kid: KID, ...(params as Partial<WrapParams>) } as WrapParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-002
  it('accepts 16 and 2048 bytes', async () => {
    const fake = loginDevice().always('POST', '/api/crypto/cipher/wrap', { body: { wrapped: 'AA==' } });
    const client = loggedInClient(fake);
    await client.crypto.wrap({ kid: KID, msg: bytes(16) });
    await client.crypto.wrap({ kid: KID, msg: bytes(2048) });
    expect(operationRequests(fake)).toHaveLength(2);
  }, 60_000);
});

describe('crypto.unwrap', () => {
  // verifies: REQ-OPS-003, REQ-AUTH-005
  it('posts {kid, msg} plus alg and iv when given, with scope keymgmt:use:<kid>, and returns the unwrapped bytes', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/unwrap', { body: { unwrapped: b64(bytes(32, 3)) } }, { body: { unwrapped: 'AA==' } });
    const client = loggedInClient(fake);
    expect(await client.crypto.unwrap({ kid: KID, msg: bytes(40) })).toEqual(bytes(32, 3));
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/cipher/unwrap')).toEqual({ kid: KID, msg: b64(bytes(40)) });

    await client.crypto.unwrap({ kid: KID, msg: bytes(24), alg: 'AES128', iv: bytes(8, 0xa6) });
    expect(operationRequests(fake)[1]?.json()).toEqual({ kid: KID, msg: b64(bytes(24)), alg: 'AES128', iv: 'pqampqampqY=' });
  }, 60_000);

  // verifies: REQ-OPS-003
  it.each([[bytes(39)], [bytes(4)], [bytes(0)]])('rejects input that is not a positive multiple of 8 bytes', async (msg) => {
    const fake = loginDevice();
    await expect(loggedInClient(fake).crypto.unwrap({ kid: KID, msg })).rejects.toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-003
  it('raises HemOperationFailedError for a 406 (integrity check failed)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/unwrap', { status: 406 });
    await expect(loggedInClient(fake).crypto.unwrap({ kid: KID, msg: bytes(40) })).rejects.toThrow(HemOperationFailedError);
  }, 60_000);
});

describe('crypto operations share the per-key token with key get', () => {
  // verifies: REQ-AUTH-005, REQ-AUTH-004
  it('logs in once for keys.get, hmac, wrap and unwrap on one key', async () => {
    const fake = loginDevice()
      .on('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 1 } })
      .on('POST', '/api/crypto/hmac/hash', { body: { mac: 'AA==' } })
      .on('POST', '/api/crypto/cipher/wrap', { body: { wrapped: 'AA==' } })
      .on('POST', '/api/crypto/cipher/unwrap', { body: { unwrapped: 'AA==' } });
    const client = loggedInClient(fake);
    await client.keys.get(KID);
    await client.crypto.hmac({ kid: KID, msg: bytes(1) });
    await client.crypto.wrap({ kid: KID, msg: bytes(16) });
    await client.crypto.unwrap({ kid: KID, msg: bytes(24) });
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
  }, 60_000);
});

describe('crypto operations over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('raise HemTlsRequiredError with zero fetch calls', async () => {
    const fake = new FakeFetch();
    const client = new HemClient({ url: 'http://192.168.7.1', fetch: fake.fetch, passphrase: v.passphrase, checkinRelay: null });
    await expect(client.crypto.hmac({ kid: KID, msg: bytes(1) })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.wrap({ kid: KID, msg: bytes(16) })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.unwrap({ kid: KID, msg: bytes(24) })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
