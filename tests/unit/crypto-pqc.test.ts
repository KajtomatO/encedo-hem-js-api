// ML-KEM encapsulation and decapsulation, ML-DSA sign and verify (M2), including the firmware's
// non-standard status on a failed ML-DSA verification (ARCHITECTURE.md §6 quirk 3).
import { describe, expect, it } from 'vitest';
import {
  HemBadRequestError,
  HemDeviceError,
  HemForbiddenError,
  HemOperationFailedError,
  HemTlsRequiredError,
  HemUnauthenticatedError,
  HemUnreachableError,
  HemValidationError,
  MAX_CONTEXT_BYTES,
  MLDSA_SIGNATURE_BYTES,
  MLKEM_CIPHERTEXT_BYTES,
  type MldsaVerifyParams,
  type MlkemDecapsParams,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';

const KID = '00112233445566778899aabbccddeeff';
const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const MSG = Uint8Array.from([1, 2, 3]);
const SS = bytes(32, 7);
const CT = bytes(1088, 8);

function expectJsonPost(fake: FakeFetch, path: string): Record<string, unknown> {
  const [request] = operationRequests(fake);
  expect(request?.method).toBe('POST');
  expect(request?.url.href).toBe(`https://my.ence.do${path}`);
  expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
  return request?.json() as Record<string, unknown>;
}

describe('crypto.mlkemEncaps', () => {
  // verifies: REQ-OPS-011, REQ-AUTH-005
  it('posts {kid} with scope keymgmt:use:<kid> and returns the parameter set, secret and ciphertext', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/encaps', { body: { alg: 'MLKEM768', ss: b64(SS), ct: b64(CT) } });
    const result = await loggedInClient(fake).crypto.mlkemEncaps({ kid: KID.toUpperCase() });
    expect(result).toEqual({ alg: 'MLKEM768', sharedSecret: SS, ciphertext: CT });
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/pqc/mlkem/encaps')).toEqual({ kid: KID });
  });

  // verifies: REQ-OPS-011
  it('raises HemOperationFailedError for 406 (key missing or not ML-KEM)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/encaps', { status: 406 });
    await expect(loggedInClient(fake).crypto.mlkemEncaps({ kid: KID })).rejects.toThrow(HemOperationFailedError);
  });

  // verifies: REQ-API-005
  it('refuses a bad key id without any request', async () => {
    const fake = loginDevice();
    await expect(loggedInClient(fake).crypto.mlkemEncaps({ kid: 'nope' })).rejects.toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('crypto.mlkemDecaps', () => {
  // verifies: REQ-OPS-012, REQ-AUTH-005
  it('posts {kid, ct} with scope keymgmt:use:<kid> and returns the 32-byte secret only', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/decaps', { body: { alg: 'some internal string', ss: b64(SS) } });
    const result = await loggedInClient(fake).crypto.mlkemDecaps({ kid: KID, ct: CT });
    expect(result).toEqual(SS);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/pqc/mlkem/decaps')).toEqual({ kid: KID, ct: b64(CT) });
  });

  // verifies: REQ-OPS-012
  it('does not need the alg field and never exposes it', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/decaps', { body: { ss: b64(SS) } });
    expect(await loggedInClient(fake).crypto.mlkemDecaps({ kid: KID, ct: CT })).toEqual(SS);
  });

  // verifies: REQ-OPS-012
  it.each(Object.values(MLKEM_CIPHERTEXT_BYTES))('accepts a %i-byte ciphertext', async (length) => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/decaps', { body: { ss: b64(SS) } });
    await loggedInClient(fake).crypto.mlkemDecaps({ kid: KID, ct: bytes(length) });
    expect(operationRequests(fake)).toHaveLength(1);
  });

  // verifies: REQ-OPS-012, REQ-API-005
  it.each([
    [{ kid: KID, ct: bytes(767) }, 'ct'],
    [{ kid: KID, ct: bytes(1089) }, 'ct'],
    [{ kid: KID, ct: bytes(0) }, 'ct'],
    [{ kid: KID, ct: 'text' }, 'ct'],
    [{ kid: KID }, 'ct'],
    [{ kid: 'k', ct: CT }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.mlkemDecaps(params as unknown as MlkemDecapsParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-012
  it('raises HemOperationFailedError for 406', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mlkem/decaps', { status: 406 });
    await expect(loggedInClient(fake).crypto.mlkemDecaps({ kid: KID, ct: CT })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('crypto.mldsaSign', () => {
  // verifies: REQ-OPS-013, REQ-AUTH-005
  it('posts {kid, msg} with scope keymgmt:use:<kid> and returns the parameter set and signature', async () => {
    const signature = bytes(3309, 9);
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mldsa/sign', { body: { alg: 'MLDSA65', sign: b64(signature) } });
    const result = await loggedInClient(fake).crypto.mldsaSign({ kid: KID.toUpperCase(), msg: MSG });
    expect(result).toEqual({ alg: 'MLDSA65', signature });
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/pqc/mldsa/sign')).toEqual({ kid: KID, msg: 'AQID' });
  });

  // verifies: REQ-OPS-013
  it('adds ctx (base64) when given, up to 255 bytes', async () => {
    const fake = loginDevice().always('POST', '/api/crypto/pqc/mldsa/sign', { body: { alg: 'MLDSA44', sign: 'AQ==' } });
    const client = loggedInClient(fake);
    await client.crypto.mldsaSign({ kid: KID, msg: MSG, ctx: Uint8Array.from([9]) });
    await client.crypto.mldsaSign({ kid: KID, msg: MSG, ctx: bytes(MAX_CONTEXT_BYTES) });
    const [short, max] = operationRequests(fake);
    expect(short?.json()).toEqual({ kid: KID, msg: 'AQID', ctx: 'CQ==' });
    expect((max?.json() as { ctx: string }).ctx).toBe(b64(bytes(MAX_CONTEXT_BYTES)));
  });

  // verifies: REQ-OPS-013, REQ-API-005
  it.each([
    [{ kid: KID, msg: MSG, ctx: bytes(MAX_CONTEXT_BYTES + 1) }, 'ctx'],
    [{ kid: KID, msg: MSG, ctx: 'text' }, 'ctx'],
    [{ kid: KID, msg: bytes(0) }, 'msg'],
    [{ kid: KID, msg: bytes(2049) }, 'msg'],
    [{ kid: 'k', msg: MSG }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.mldsaSign(params as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-013
  it('raises HemOperationFailedError for 406', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mldsa/sign', { status: 406 });
    await expect(loggedInClient(fake).crypto.mldsaSign({ kid: KID, msg: MSG })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('crypto.mldsaVerify', () => {
  const SIGN = bytes(2420, 5);
  const verify = (fake: FakeFetch, extra: Partial<MldsaVerifyParams> = {}): Promise<boolean> =>
    loggedInClient(fake).crypto.mldsaVerify({ kid: KID, msg: MSG, sign: SIGN, ...extra });

  // verifies: REQ-OPS-014, REQ-AUTH-005
  it('posts {kid, msg, sign} plus ctx with scope keymgmt:use:<kid> and returns true on 200', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mldsa/verify', { status: 200 });
    expect(await verify(fake, { ctx: Uint8Array.from([1]) })).toBe(true);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/pqc/mldsa/verify')).toEqual({ kid: KID, msg: 'AQID', sign: b64(SIGN), ctx: 'AQ==' });
  });

  // verifies: REQ-OPS-014, REQ-OPS-004
  it.each([795, 100, 406, 400, 409, 412, 418, 500, 999])('returns false for a completed response with status %i', async (status) => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mldsa/verify', { status });
    expect(await verify(fake)).toBe(false);
  });

  // verifies: REQ-OPS-014, REQ-OPS-004
  it.each([
    [401, HemUnauthenticatedError],
    [403, HemForbiddenError],
  ])('raises for status %i', async (status, ErrorClass) => {
    const fake = loginDevice().always('POST', '/api/crypto/pqc/mldsa/verify', { status });
    await expect(verify(fake)).rejects.toThrow(ErrorClass);
  });

  // verifies: REQ-OPS-014
  it('raises for a transport failure and for a redirect instead of answering false', async () => {
    const unreachable = loginDevice().on('POST', '/api/crypto/pqc/mldsa/verify', new TypeError('fetch failed'));
    await expect(verify(unreachable)).rejects.toThrow(HemUnreachableError);
    const redirect = loginDevice().on('POST', '/api/crypto/pqc/mldsa/verify', { status: 302, headers: { location: '/elsewhere' } });
    await expect(verify(redirect)).rejects.toThrow(HemDeviceError);
  });

  // verifies: REQ-OPS-014, REQ-API-005
  it('refuses a request whose JSON body would exceed 7300 bytes, with zero fetch calls', async () => {
    const fake = loginDevice();
    const error = await verify(fake, { msg: bytes(2048), sign: bytes(MLDSA_SIGNATURE_BYTES.MLDSA87) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('body');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-014
  it('sends an ML-DSA-87 signature with a 798-byte message (the body limit leaves room for about 800)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/pqc/mldsa/verify', { status: 200 });
    expect(await verify(fake, { msg: bytes(798), sign: bytes(MLDSA_SIGNATURE_BYTES.MLDSA87) })).toBe(true);
  });

  // verifies: REQ-OPS-014, REQ-API-005
  it.each([
    [{ sign: bytes(0) }, 'sign'],
    [{ sign: bytes(MLDSA_SIGNATURE_BYTES.MLDSA87 + 1) }, 'sign'],
    [{ sign: 'text' }, 'sign'],
    [{ ctx: bytes(MAX_CONTEXT_BYTES + 1) }, 'ctx'],
    [{ msg: bytes(0) }, 'msg'],
    [{ kid: 'k' }, 'kid'],
  ])('refuses %j naming %s without any request', async (extra, parameter) => {
    const fake = loginDevice();
    const error = await verify(fake, extra as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-004
  it('a 400 on the other verify operations still raises (the ML-DSA rule is not shared)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/verify', { status: 400 });
    await expect(loggedInClient(fake).crypto.hmacVerify({ kid: KID, msg: MSG, mac: bytes(32) })).rejects.toThrow(HemBadRequestError);
  });
});

describe('post-quantum operations over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('are refused before any request', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake, { url: 'http://192.168.7.1' });
    await expect(client.crypto.mlkemEncaps({ kid: KID })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.mlkemDecaps({ kid: KID, ct: CT })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.mldsaSign({ kid: KID, msg: MSG })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.mldsaVerify({ kid: KID, msg: MSG, sign: bytes(1) })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
