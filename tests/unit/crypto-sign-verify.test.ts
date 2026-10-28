// HMAC verify, ExDSA sign and verify (M2), and the verify-result semantics shared by every verify operation.
import { describe, expect, it } from 'vitest';
import {
  HemBadRequestError,
  HemDeviceStateError,
  HemForbiddenError,
  HemOperationFailedError,
  HemTlsRequiredError,
  HemUnauthenticatedError,
  HemUnreachableError,
  HemValidationError,
  MAX_CONTEXT_BYTES,
  MAX_MAC_BYTES,
  SIGNATURE_ALGORITHMS,
  type SignParams,
  type VerifyParams,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';

const KID = '00112233445566778899aabbccddeeff';
const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const MSG = Uint8Array.from([1, 2, 3]);

function expectJsonPost(fake: FakeFetch, path: string): Record<string, unknown> {
  const [request] = operationRequests(fake);
  expect(request?.method).toBe('POST');
  expect(request?.url.href).toBe(`https://my.ence.do${path}`);
  expect(Object.keys(request?.headers ?? {}).sort()).toEqual(['authorization', 'content-type']);
  expect(request?.headers['content-type']).toBe('application/json');
  return request?.json() as Record<string, unknown>;
}

describe('crypto.hmacVerify', () => {
  // verifies: REQ-OPS-005, REQ-AUTH-005
  it('posts {kid, msg, mac} without alg, with scope keymgmt:use:<kid>, and returns true on 200', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/verify', { status: 200 });
    const result = await loggedInClient(fake).crypto.hmacVerify({ kid: KID.toUpperCase(), msg: MSG, mac: bytes(32, 7) });
    expect(result).toBe(true);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/hmac/verify')).toEqual({ kid: KID, msg: 'AQID', mac: b64(bytes(32, 7)) });
  });

  // verifies: REQ-OPS-005, REQ-OPS-004
  it('returns false on the mismatch response (406)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/verify', { status: 406 });
    await expect(loggedInClient(fake).crypto.hmacVerify({ kid: KID, msg: MSG, mac: bytes(32) })).resolves.toBe(false);
  });

  // verifies: REQ-OPS-005, REQ-API-005
  it.each([
    [{ kid: KID, msg: MSG, mac: bytes(MAX_MAC_BYTES + 1) }, 'mac'],
    [{ kid: KID, msg: MSG, mac: bytes(0) }, 'mac'],
    [{ kid: KID, msg: MSG, mac: 'AQ==' }, 'mac'],
    [{ kid: KID, msg: bytes(0), mac: bytes(32) }, 'msg'],
    [{ kid: KID, msg: bytes(2049), mac: bytes(32) }, 'msg'],
    [{ kid: 'k', msg: MSG, mac: bytes(32) }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.hmacVerify(params as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-005
  it('accepts a 64-byte MAC', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/verify', { status: 200 });
    await loggedInClient(fake).crypto.hmacVerify({ kid: KID, msg: MSG, mac: bytes(64) });
    expect(operationRequests(fake)).toHaveLength(1);
  });
});

describe('crypto.sign', () => {
  // verifies: REQ-OPS-006, REQ-AUTH-005
  it('posts {kid, msg, alg} with scope keymgmt:use:<kid> and returns the signature bytes', async () => {
    const signature = bytes(64, 5);
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/sign', { body: { sign: b64(signature) } });
    const result = await loggedInClient(fake).crypto.sign({ kid: KID.toUpperCase(), msg: MSG, alg: 'Ed25519' });
    expect(result).toEqual(signature);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/exdsa/sign')).toEqual({ kid: KID, msg: 'AQID', alg: 'Ed25519' });
  });

  // verifies: REQ-OPS-006
  it.each(['Ed25519ph', 'Ed25519ctx', 'Ed448', 'Ed448ph'] as const)('adds ctx (base64) with %s', async (alg) => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/sign', { body: { sign: 'AQ==' } });
    await loggedInClient(fake).crypto.sign({ kid: KID, msg: MSG, alg, ctx: Uint8Array.from([9, 8]) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, msg: 'AQID', alg, ctx: 'CQg=' });
  });

  // verifies: REQ-OPS-006
  it.each(SIGNATURE_ALGORITHMS)('accepts algorithm %s', async (alg) => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/sign', { body: { sign: 'AQ==' } });
    await loggedInClient(fake).crypto.sign({ kid: KID, msg: MSG, alg });
    expect((operationRequests(fake)[0]?.json() as { alg: string }).alg).toBe(alg);
  });

  // verifies: REQ-OPS-006, REQ-API-005
  it.each([
    [{ kid: KID, msg: MSG, alg: 'SHA1WithECDSA' }, 'alg'],
    [{ kid: KID, msg: MSG, alg: 'ed25519' }, 'alg'],
    [{ kid: KID, msg: MSG }, 'alg'],
    [{ kid: KID, msg: MSG, alg: 'Ed25519ph', ctx: bytes(MAX_CONTEXT_BYTES + 1) }, 'ctx'],
    [{ kid: KID, msg: MSG, alg: 'Ed25519ph', ctx: 'text' }, 'ctx'],
    [{ kid: KID, msg: MSG, alg: 'Ed25519', ctx: bytes(1) }, 'ctx'],
    [{ kid: KID, msg: MSG, alg: 'SHA256WithECDSA', ctx: bytes(1) }, 'ctx'],
    [{ kid: KID, msg: bytes(0), alg: 'Ed25519' }, 'msg'],
    [{ kid: KID, msg: bytes(2049), alg: 'Ed25519' }, 'msg'],
    [{ kid: 'k', msg: MSG, alg: 'Ed25519' }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.sign(params as unknown as SignParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-006
  it('accepts a 255-byte context and a 2048-byte message', async () => {
    const fake = loginDevice().always('POST', '/api/crypto/exdsa/sign', { body: { sign: 'AQ==' } });
    await loggedInClient(fake).crypto.sign({ kid: KID, msg: bytes(2048), alg: 'Ed448', ctx: bytes(MAX_CONTEXT_BYTES) });
    expect(operationRequests(fake)).toHaveLength(1);
  });

  // verifies: REQ-OPS-006
  it('raises HemOperationFailedError for 406 (key not a signing key, algorithm mismatch)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/sign', { status: 406 });
    await expect(loggedInClient(fake).crypto.sign({ kid: KID, msg: MSG, alg: 'SHA256WithECDSA' })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('crypto.verify', () => {
  // verifies: REQ-OPS-007, REQ-AUTH-005
  it('posts {kid, msg, sign, alg} with scope keymgmt:use:<kid> and returns true on 200', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/verify', { status: 200 });
    const result = await loggedInClient(fake).crypto.verify({ kid: KID.toUpperCase(), msg: MSG, sign: bytes(64, 5), alg: 'Ed25519' });
    expect(result).toBe(true);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    expect(expectJsonPost(fake, '/api/crypto/exdsa/verify')).toEqual({ kid: KID, msg: 'AQID', alg: 'Ed25519', sign: b64(bytes(64, 5)) });
  });

  // verifies: REQ-OPS-007
  it('adds ctx with a context variant', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/verify', { status: 200 });
    await loggedInClient(fake).crypto.verify({ kid: KID, msg: MSG, sign: bytes(114), alg: 'Ed448ph', ctx: Uint8Array.from([1]) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, msg: 'AQID', alg: 'Ed448ph', ctx: 'AQ==', sign: b64(bytes(114)) });
  });

  // verifies: REQ-OPS-007, REQ-OPS-004
  it('returns false on the invalid-signature response (406)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/exdsa/verify', { status: 406 });
    await expect(loggedInClient(fake).crypto.verify({ kid: KID, msg: MSG, sign: bytes(64), alg: 'Ed25519' })).resolves.toBe(false);
  });

  // verifies: REQ-OPS-007, REQ-API-005
  it.each([
    [{ kid: KID, msg: MSG, sign: bytes(0), alg: 'Ed25519' }, 'sign'],
    [{ kid: KID, msg: MSG, sign: 'AQ==', alg: 'Ed25519' }, 'sign'],
    [{ kid: KID, msg: MSG, alg: 'Ed25519' }, 'sign'],
    [{ kid: KID, msg: MSG, sign: bytes(64), alg: 'RSA' }, 'alg'],
    [{ kid: KID, msg: MSG, sign: bytes(64), alg: 'Ed25519', ctx: bytes(1) }, 'ctx'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.verify(params as unknown as VerifyParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });
});

describe('verify-result semantics', () => {
  const calls = {
    hmacVerify: (fake: FakeFetch) => loggedInClient(fake).crypto.hmacVerify({ kid: KID, msg: MSG, mac: bytes(32) }),
    verify: (fake: FakeFetch) => loggedInClient(fake).crypto.verify({ kid: KID, msg: MSG, sign: bytes(64), alg: 'Ed25519' }),
  };
  const paths = { hmacVerify: '/api/crypto/hmac/verify', verify: '/api/crypto/exdsa/verify' } as const;

  // verifies: REQ-OPS-004
  it.each(Object.keys(calls) as (keyof typeof calls)[])('%s: 200 gives true, 406 gives false', async (name) => {
    const ok = loginDevice().on('POST', paths[name], { status: 200 });
    await expect(calls[name](ok)).resolves.toBe(true);
    const bad = loginDevice().on('POST', paths[name], { status: 406 });
    await expect(calls[name](bad)).resolves.toBe(false);
  });

  // verifies: REQ-OPS-004
  it.each([
    [400, HemBadRequestError],
    [401, HemUnauthenticatedError],
    [403, HemForbiddenError],
    [409, HemDeviceStateError],
  ])('raises the error class of status %i instead of answering false', async (status, ErrorClass) => {
    for (const name of Object.keys(calls) as (keyof typeof calls)[]) {
      // 401 on the operation: the client re-authenticates once (REQ-AUTH-008); the fake keeps answering 401.
      const fake = loginDevice().always('POST', paths[name], { status });
      await expect(calls[name](fake), name).rejects.toThrow(ErrorClass);
    }
  });

  // verifies: REQ-OPS-004
  it('raises a transport failure instead of answering false', async () => {
    for (const name of Object.keys(calls) as (keyof typeof calls)[]) {
      const fake = loginDevice().on('POST', paths[name], new TypeError('fetch failed'));
      await expect(calls[name](fake), name).rejects.toThrow(HemUnreachableError);
    }
  });
});

describe('hmacVerify, sign and verify over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('are refused before any request', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake, { url: 'http://192.168.7.1' });
    await expect(client.crypto.hmacVerify({ kid: KID, msg: MSG, mac: bytes(32) })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.sign({ kid: KID, msg: MSG, alg: 'Ed25519' })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.crypto.verify({ kid: KID, msg: MSG, sign: bytes(64), alg: 'Ed25519' })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
