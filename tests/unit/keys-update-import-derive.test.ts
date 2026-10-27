// Key update, import and derive (M2): bodies, scopes, validation before sending, error mapping.
import { describe, expect, it } from 'vitest';
import {
  DERIVABLE_KEY_TYPES,
  type DeriveKeyParams,
  HemOperationFailedError,
  HemProtocolError,
  HemTlsRequiredError,
  HemValidationError,
  IMPORTABLE_KEY_TYPES,
  type ImportKeyParams,
  KEY_TYPES,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';

const KID = '0123456789abcdef0123456789abcdef';
const PEER_KID = 'fedcba9876543210fedcba9876543210';
const NEW_KID = '00112233445566778899aabbccddeeff';
const PUBKEY = Uint8Array.from([0x02, 0xaa, 0xbb]);

describe('keys.update', () => {
  // verifies: REQ-KEY-006
  it('posts {kid, label, descr} with scope keymgmt:upd and resolves on the empty 200', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/update', { status: 200 });
    await expect(loggedInClient(fake).keys.update({ kid: KID.toUpperCase(), label: 'renamed', descr: Uint8Array.from([1, 2]) })).resolves.toBeUndefined();
    expect(loginScopes(fake)).toEqual(['keymgmt:upd']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.url.href).toBe('https://my.ence.do/api/keymgmt/update');
    expect(request?.headers['content-type']).toBe('application/json');
    expect(request?.json()).toEqual({ kid: KID, label: 'renamed', descr: 'AQI=' });
  });

  // verifies: REQ-KEY-006
  it('clears the description by leaving the field out when descr is empty', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/update', { status: 200 });
    await loggedInClient(fake).keys.update({ kid: KID, label: 'k', descr: new Uint8Array(0) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, label: 'k' });
  });

  // verifies: REQ-KEY-006, REQ-API-005
  it.each([
    [{ kid: KID, label: 'k' }, 'descr'],
    [{ kid: KID, label: 'k', descr: 'text' }, 'descr'],
    [{ kid: KID, label: 'k', descr: new Uint8Array(65) }, 'descr'],
    [{ kid: KID, label: '', descr: new Uint8Array(0) }, 'label'],
    [{ kid: KID, descr: new Uint8Array(0) }, 'label'],
    [{ kid: 'nope', label: 'k', descr: new Uint8Array(0) }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).keys.update(params as never).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-KEY-006
  it('raises HemOperationFailedError for 406 (unknown key id)', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/update', { status: 406 });
    await expect(loggedInClient(fake).keys.update({ kid: KID, label: 'k', descr: new Uint8Array(0) })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('keys.import', () => {
  // verifies: REQ-KEY-008
  it('posts {label, pubkey, type} with scope keymgmt:imp and returns the key id in lower case', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { body: { kid: NEW_KID.toUpperCase() } });
    const kid = await loggedInClient(fake).keys.import({ label: 'peer', pubkey: PUBKEY, type: 'SECP256R1' });
    expect(kid).toBe(NEW_KID);
    expect(loginScopes(fake)).toEqual(['keymgmt:imp']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.url.href).toBe('https://my.ence.do/api/keymgmt/import');
    expect(request?.json()).toEqual({ label: 'peer', pubkey: 'Aqq7', type: 'SECP256R1' });
  });

  // verifies: REQ-KEY-008
  it('adds mode and descr when given', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { body: { kid: NEW_KID } });
    await loggedInClient(fake).keys.import({ label: 'peer', pubkey: PUBKEY, type: 'SECP256K1', mode: 'ECDH,ExDSA', descr: Uint8Array.from([7]) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ label: 'peer', pubkey: 'Aqq7', type: 'SECP256K1', mode: 'ECDH,ExDSA', descr: 'Bw==' });
  });

  // verifies: REQ-KEY-008
  it.each(IMPORTABLE_KEY_TYPES)('accepts type %s', async (type) => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { body: { kid: NEW_KID } });
    await loggedInClient(fake).keys.import({ label: 'k', pubkey: PUBKEY, type });
    expect((operationRequests(fake)[0]?.json() as { type: string }).type).toBe(type);
  });

  // verifies: REQ-KEY-008
  it('lists exactly the asymmetric creatable types as importable', () => {
    const symmetric = KEY_TYPES.filter((type) => type.startsWith('SHA') || type.startsWith('AES'));
    expect([...IMPORTABLE_KEY_TYPES].sort()).toEqual(KEY_TYPES.filter((type) => !symmetric.includes(type)).sort());
  });

  // verifies: REQ-KEY-008, REQ-API-005
  it.each([
    [{ label: 'k', pubkey: PUBKEY, type: 'AES256' }, 'type'],
    [{ label: 'k', pubkey: PUBKEY, type: 'SHA2-256' }, 'type'],
    [{ label: 'k', pubkey: PUBKEY, type: 'secp256r1' }, 'type'],
    [{ label: 'k', pubkey: new Uint8Array(0), type: 'ED25519' }, 'pubkey'],
    [{ label: 'k', pubkey: 'AQID', type: 'ED25519' }, 'pubkey'],
    [{ label: 'k', pubkey: PUBKEY, type: 'SECP256R1', mode: 'ExDSA,ECDH' }, 'mode'],
    [{ label: 'x'.repeat(33), pubkey: PUBKEY, type: 'ED25519' }, 'label'],
    [{ label: 'k', pubkey: PUBKEY, type: 'ED25519', descr: new Uint8Array(65) }, 'descr'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).keys.import(params as unknown as ImportKeyParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-KEY-008
  it('applies no size limit of its own to the public key (an 800-byte ML-KEM key is sent)', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { body: { kid: NEW_KID } });
    await loggedInClient(fake).keys.import({ label: 'kem', pubkey: new Uint8Array(800), type: 'MLKEM512' });
    expect(operationRequests(fake)).toHaveLength(1);
  });

  // verifies: REQ-KEY-008
  it('raises HemOperationFailedError for 406 with a message naming a duplicate key among the causes', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { status: 406 });
    const error = await loggedInClient(fake).keys.import({ label: 'k', pubkey: PUBKEY, type: 'ED25519' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemOperationFailedError);
    expect((error as HemOperationFailedError).message).toMatch(/duplicate/);
    expect((error as HemOperationFailedError).status).toBe(406);
    expect((error as HemOperationFailedError).operation).toBe('keys.import');
  });

  it('rejects a reply without a valid key id', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/import', { body: { kid: 'xyz' } });
    await expect(loggedInClient(fake).keys.import({ label: 'k', pubkey: PUBKEY, type: 'ED25519' })).rejects.toThrow(HemProtocolError);
  });
});

describe('keys.derive', () => {
  // verifies: REQ-KEY-009
  it('posts {kid, label, type, ext_kid} with scope keymgmt:gen and returns the new key id', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/derive', { body: { kid: NEW_KID } });
    const kid = await loggedInClient(fake).keys.derive({ kid: KID.toUpperCase(), label: 'shared', type: 'AES256', peer: { extKid: PEER_KID.toUpperCase() } });
    expect(kid).toBe(NEW_KID);
    expect(loginScopes(fake)).toEqual(['keymgmt:gen']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.url.href).toBe('https://my.ence.do/api/keymgmt/derive');
    expect(request?.json()).toEqual({ kid: KID, label: 'shared', type: 'AES256', ext_kid: PEER_KID });
  });

  // verifies: REQ-KEY-009
  it('sends a raw peer as pubkey (base64), plus mode and descr when given', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/derive', { body: { kid: NEW_KID } });
    await loggedInClient(fake).keys.derive({ kid: KID, label: 's', type: 'SECP256R1', peer: { pubkey: PUBKEY }, mode: 'ExDSA', descr: Uint8Array.from([9]) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, label: 's', type: 'SECP256R1', pubkey: 'Aqq7', mode: 'ExDSA', descr: 'CQ==' });
  });

  // verifies: REQ-KEY-009
  it.each(DERIVABLE_KEY_TYPES)('accepts target type %s', async (type) => {
    const fake = loginDevice().on('POST', '/api/keymgmt/derive', { body: { kid: NEW_KID } });
    await loggedInClient(fake).keys.derive({ kid: KID, label: 'k', type, peer: { extKid: PEER_KID } });
    expect((operationRequests(fake)[0]?.json() as { type: string }).type).toBe(type);
  });

  // verifies: REQ-KEY-009
  it('lists exactly the creatable types without MLKEM* and MLDSA* as derivable', () => {
    expect([...DERIVABLE_KEY_TYPES]).toEqual(KEY_TYPES.filter((type) => !type.startsWith('MLKEM') && !type.startsWith('MLDSA')));
  });

  // verifies: REQ-KEY-009, REQ-API-005
  it.each([
    [{ kid: KID, label: 'k', type: 'AES256', peer: { extKid: PEER_KID, pubkey: PUBKEY } }, 'peer'],
    [{ kid: KID, label: 'k', type: 'AES256', peer: {} }, 'peer'],
    [{ kid: KID, label: 'k', type: 'AES256' }, 'peer'],
    [{ kid: KID, label: 'k', type: 'AES256', peer: { extKid: 'short' } }, 'peer.extKid'],
    [{ kid: KID, label: 'k', type: 'AES256', peer: { pubkey: new Uint8Array(0) } }, 'peer.pubkey'],
    [{ kid: KID, label: 'k', type: 'MLKEM768', peer: { extKid: PEER_KID } }, 'type'],
    [{ kid: KID, label: 'k', type: 'MLDSA44', peer: { extKid: PEER_KID } }, 'type'],
    [{ kid: KID, label: 'k', type: 'aes256', peer: { extKid: PEER_KID } }, 'type'],
    [{ kid: KID, label: 'k', type: 'AES256', peer: { extKid: PEER_KID }, mode: 'ecdh' }, 'mode'],
    [{ kid: 'x', label: 'k', type: 'AES256', peer: { extKid: PEER_KID } }, 'kid'],
    [{ kid: KID, label: '', type: 'AES256', peer: { extKid: PEER_KID } }, 'label'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).keys.derive(params as unknown as DeriveKeyParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-KEY-009
  it('raises HemProtocolError when the device echoes the source key id (nothing was derived)', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/derive', { body: { kid: KID.toUpperCase() } });
    const error = await loggedInClient(fake).keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: PEER_KID } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemProtocolError);
    expect((error as HemProtocolError).message).toMatch(/source key id/);
  });

  // verifies: REQ-KEY-009
  it('raises HemOperationFailedError for 406', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/derive', { status: 406 });
    await expect(loggedInClient(fake).keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: PEER_KID } })).rejects.toThrow(HemOperationFailedError);
  });
});

describe('update, import and derive over plain HTTP', () => {
  // verifies: REQ-NET-003
  it('are refused before any request', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake, { url: 'http://192.168.7.1' });
    await expect(client.keys.update({ kid: KID, label: 'k', descr: new Uint8Array(0) })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.import({ label: 'k', pubkey: PUBKEY, type: 'ED25519' })).rejects.toThrow(HemTlsRequiredError);
    await expect(client.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: PEER_KID } })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});
