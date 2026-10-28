// AES encrypt and decrypt in ECB, CBC and GCM mode (M2).
import { describe, expect, it } from 'vitest';
import {
  CIPHER_ALGORITHMS,
  type DecryptParams,
  type EncryptParams,
  HemOperationFailedError,
  HemProtocolError,
  HemTlsRequiredError,
  HemValidationError,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';

const KID = '00112233445566778899aabbccddeeff';
const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const IV = bytes(16, 1);
const TAG = bytes(16, 2);
const CT = bytes(32, 3);
const PT = bytes(20, 4);

function expectJsonPost(fake: FakeFetch, path: string): Record<string, unknown> {
  const [request] = operationRequests(fake);
  expect(request?.method).toBe('POST');
  expect(request?.url.href).toBe(`https://my.ence.do${path}`);
  expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
  return request?.json() as Record<string, unknown>;
}

describe('crypto.encrypt', () => {
  // verifies: REQ-OPS-008, REQ-AUTH-005
  it('posts {kid, msg, alg} with scope keymgmt:use:<kid> and returns ciphertext, iv and tag for GCM', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: b64(CT), iv: b64(IV), tag: b64(TAG) } });
    const result = await loggedInClient(fake).crypto.encrypt({ kid: KID.toUpperCase(), msg: PT, alg: 'AES256-GCM' });
    expect(result).toEqual({ ciphertext: CT, iv: IV, tag: TAG });
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/cipher/encrypt')).toEqual({ kid: KID, msg: b64(PT), alg: 'AES256-GCM' });
  });

  // verifies: REQ-OPS-008
  it('returns ciphertext and iv for CBC, ciphertext only for ECB', async () => {
    const fake = loginDevice()
      .on('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: b64(CT), iv: b64(IV) } }, { body: { ciphertext: b64(CT) } });
    const client = loggedInClient(fake);
    expect(await client.crypto.encrypt({ kid: KID, msg: PT, alg: 'AES128-CBC' })).toEqual({ ciphertext: CT, iv: IV });
    expect(await client.crypto.encrypt({ kid: KID, msg: bytes(32), alg: 'AES192-ECB' })).toEqual({ ciphertext: CT });
  });

  // verifies: REQ-OPS-008
  it('adds aad (base64) for GCM', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: b64(CT), iv: b64(IV), tag: b64(TAG) } });
    await loggedInClient(fake).crypto.encrypt({ kid: KID, msg: PT, alg: 'AES128-GCM', aad: Uint8Array.from([7, 7]) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, msg: b64(PT), alg: 'AES128-GCM', aad: 'Bwc=' });
  });

  // verifies: REQ-OPS-008
  it.each(CIPHER_ALGORITHMS)('accepts algorithm %s', async (alg) => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: b64(CT), iv: b64(IV), tag: b64(TAG) } });
    await loggedInClient(fake).crypto.encrypt({ kid: KID, msg: bytes(16), alg });
    expect((operationRequests(fake)[0]?.json() as { alg: string }).alg).toBe(alg);
  });

  // verifies: REQ-OPS-008, REQ-API-005
  it.each([
    [{ kid: KID, msg: PT, alg: 'AES256-CTR' }, 'alg'],
    [{ kid: KID, msg: PT, alg: 'aes256-gcm' }, 'alg'],
    [{ kid: KID, msg: PT }, 'alg'],
    [{ kid: KID, msg: bytes(20), alg: 'AES256-ECB' }, 'msg'],
    [{ kid: KID, msg: bytes(0), alg: 'AES256-CBC' }, 'msg'],
    [{ kid: KID, msg: bytes(2049), alg: 'AES256-CBC' }, 'msg'],
    [{ kid: KID, msg: PT, alg: 'AES256-CBC', aad: bytes(1) }, 'aad'],
    [{ kid: KID, msg: bytes(16), alg: 'AES256-ECB', aad: bytes(1) }, 'aad'],
    [{ kid: KID, msg: PT, alg: 'AES256-GCM', aad: 'text' }, 'aad'],
    [{ kid: 'k', msg: PT, alg: 'AES256-GCM' }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.encrypt(params as unknown as EncryptParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-008
  it('raises HemProtocolError when the IV (CBC, GCM) or the tag (GCM) is missing from the reply', async () => {
    const fake = loginDevice()
      .on('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: b64(CT) } }, { body: { ciphertext: b64(CT), iv: b64(IV) } });
    const client = loggedInClient(fake);
    await expect(client.crypto.encrypt({ kid: KID, msg: PT, alg: 'AES256-CBC' })).rejects.toThrow(HemProtocolError);
    await expect(client.crypto.encrypt({ kid: KID, msg: PT, alg: 'AES256-GCM' })).rejects.toThrow(HemProtocolError);
  });

  // verifies: REQ-OPS-008
  it('raises HemOperationFailedError for 406', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/encrypt', { status: 406 });
    await expect(loggedInClient(fake).crypto.encrypt({ kid: KID, msg: PT, alg: 'AES256-GCM' })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('crypto.decrypt', () => {
  // verifies: REQ-OPS-009, REQ-AUTH-005
  it('posts {kid, msg, alg, iv, tag, aad} for GCM with scope keymgmt:use:<kid> and returns the plaintext bytes', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/decrypt', { body: { plaintext: b64(PT) } });
    const result = await loggedInClient(fake).crypto.decrypt({ kid: KID.toUpperCase(), msg: CT, alg: 'AES256-GCM', iv: IV, tag: TAG, aad: Uint8Array.from([7, 7]) });
    expect(result).toEqual(PT);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/cipher/decrypt')).toEqual({ kid: KID, msg: b64(CT), alg: 'AES256-GCM', iv: b64(IV), tag: b64(TAG), aad: 'Bwc=' });
  });

  // verifies: REQ-OPS-009
  it('posts {kid, msg, alg, iv} for CBC and {kid, msg, alg} for ECB', async () => {
    const fake = loginDevice().always('POST', '/api/crypto/cipher/decrypt', { body: { plaintext: b64(PT) } });
    const client = loggedInClient(fake);
    await client.crypto.decrypt({ kid: KID, msg: CT, alg: 'AES128-CBC', iv: IV });
    await client.crypto.decrypt({ kid: KID, msg: CT, alg: 'AES128-ECB' });
    const [cbc, ecb] = operationRequests(fake);
    expect(cbc?.json()).toEqual({ kid: KID, msg: b64(CT), alg: 'AES128-CBC', iv: b64(IV) });
    expect(ecb?.json()).toEqual({ kid: KID, msg: b64(CT), alg: 'AES128-ECB' });
  });

  // verifies: REQ-OPS-009, REQ-API-005
  it.each([
    [{ kid: KID, msg: CT, alg: 'AES256-CBC' }, 'iv'],
    [{ kid: KID, msg: CT, alg: 'AES256-GCM', tag: TAG }, 'iv'],
    [{ kid: KID, msg: CT, alg: 'AES256-CBC', iv: bytes(15) }, 'iv'],
    [{ kid: KID, msg: CT, alg: 'AES256-CBC', iv: bytes(17) }, 'iv'],
    [{ kid: KID, msg: CT, alg: 'AES256-ECB', iv: IV }, 'iv'],
    [{ kid: KID, msg: CT, alg: 'AES256-GCM', iv: IV }, 'tag'],
    [{ kid: KID, msg: CT, alg: 'AES256-GCM', iv: IV, tag: bytes(12) }, 'tag'],
    [{ kid: KID, msg: CT, alg: 'AES256-CBC', iv: IV, tag: TAG }, 'tag'],
    [{ kid: KID, msg: CT, alg: 'AES256-CBC', iv: IV, aad: bytes(1) }, 'aad'],
    [{ kid: KID, msg: bytes(20), alg: 'AES256-ECB' }, 'msg'],
    [{ kid: KID, msg: bytes(0), alg: 'AES256-GCM', iv: IV, tag: TAG }, 'msg'],
    [{ kid: KID, msg: CT, alg: 'AES256-XTS', iv: IV }, 'alg'],
    [{ kid: 'k', msg: CT, alg: 'AES256-ECB' }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.decrypt(params as unknown as DecryptParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-009
  it('raises HemOperationFailedError for 406 (decryption or authentication failure)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/cipher/decrypt', { status: 406 });
    await expect(loggedInClient(fake).crypto.decrypt({ kid: KID, msg: CT, alg: 'AES256-GCM', iv: IV, tag: TAG })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('encrypt and decrypt over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('are refused before any request', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake, { url: 'http://192.168.7.1' });
    await expect(client.crypto.encrypt({ kid: KID, msg: PT, alg: 'AES256-GCM' })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.decrypt({ kid: KID, msg: CT, alg: 'AES256-ECB' })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
