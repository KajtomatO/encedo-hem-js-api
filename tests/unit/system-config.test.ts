// Config read (M2): scope, required and optional fields, key material as bytes.
import { describe, expect, it } from 'vitest';
import { HemForbiddenError, HemProtocolError } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';

const REQUIRED = {
  iat: 1700000000,
  uts: 1700001000,
  devid: '0011223344556677',
  eid: 'AQID',
  eid_sign: 'BAUG',
  user: 'owner',
  email: 'owner@example.com',
  hostname: 'my.ence.do',
  dnsd: true,
  trusted_ts: true,
  trusted_backend: false,
  allow_keysearch: true,
  origin: '*',
  ctx: 3,
  ip: '192.168.7.1/24',
  http_option_hsts: false,
  http_option_dosprot_mode: 2,
  spk: 'BwgJ',
  nonce: 'CgsM',
};

describe('system.config', () => {
  // verifies: REQ-SYS-008, REQ-AUTH-005
  it('sends GET /api/system/config with scope system:config and no body', async () => {
    const fake = loginDevice().on('GET', '/api/system/config', { body: REQUIRED });
    await loggedInClient(fake).system.config();
    expect(loginScopes(fake)).toEqual(['system:config']);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('GET');
    expect(request?.url.href).toBe('https://my.ence.do/api/system/config');
    expect(Object.keys(request?.headers ?? {})).toEqual(['authorization']);
    expect(request?.body).toBeUndefined();
  });

  // verifies: REQ-SYS-008, REQ-API-004
  it('maps every required field, with key material as bytes, and leaves optional fields out when absent', async () => {
    const fake = loginDevice().on('GET', '/api/system/config', { body: { ...REQUIRED, unknown_future_field: 1 } });
    expect(await loggedInClient(fake).system.config()).toEqual({
      createdAt: 1700000000,
      updatedAt: 1700001000,
      devid: '0011223344556677',
      eid: Uint8Array.from([1, 2, 3]),
      eidSign: Uint8Array.from([4, 5, 6]),
      user: 'owner',
      email: 'owner@example.com',
      hostname: 'my.ence.do',
      dnsd: true,
      trustedTime: true,
      trustedBackend: false,
      allowKeysearch: true,
      origin: '*',
      ctx: 3,
      ip: '192.168.7.1/24',
      hsts: false,
      dosProtectionMode: 2,
      spk: Uint8Array.from([7, 8, 9]),
      nonce: Uint8Array.from([10, 11, 12]),
    });
  });

  // verifies: REQ-SYS-008
  it('includes instanceid and the mass-storage fields when present', async () => {
    const body = { ...REQUIRED, instanceid: '123e4567-e89b-12d3-a456-426614174000', genuine_id: 'SE-42', storage_mode: 1, storage_disk0size: 2048, storage_capacity: 4096 };
    const fake = loginDevice().on('GET', '/api/system/config', { body });
    const config = await loggedInClient(fake).system.config();
    expect(config.instanceid).toBe('123e4567-e89b-12d3-a456-426614174000');
    expect(config.genuineId).toBe('SE-42');
    expect(config.storageMode).toBe(1);
    expect(config.storageDisk0Size).toBe(2048);
    expect(config.storageCapacity).toBe(4096);
  });

  // verifies: REQ-SYS-008, REQ-API-006
  it.each(Object.keys(REQUIRED))('raises HemProtocolError naming %s when it is missing', async (field) => {
    const body: Record<string, unknown> = { ...REQUIRED };
    delete body[field];
    const fake = loginDevice().on('GET', '/api/system/config', { body });
    const error = await loggedInClient(fake).system.config().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemProtocolError);
    expect((error as HemProtocolError).message).toContain(`"${field}"`);
  });

  // verifies: REQ-SYS-008
  it('raises HemProtocolError for a field of the wrong type', async () => {
    const fake = loginDevice().on('GET', '/api/system/config', { body: { ...REQUIRED, trusted_ts: 'yes' } });
    await expect(loggedInClient(fake).system.config()).rejects.toThrow(HemProtocolError);
  });

  // verifies: REQ-SYS-008
  it('passes a 403 through as HemForbiddenError', async () => {
    const fake = loginDevice().on('GET', '/api/system/config', { status: 403 });
    await expect(loggedInClient(fake).system.config()).rejects.toThrow(HemForbiddenError);
  });

  // verifies: REQ-SYS-008
  it('is not TLS-only: it is sent over an http: device URL', async () => {
    const fake = loginDevice().on('GET', '/api/system/config', { body: REQUIRED });
    await loggedInClient(fake, { url: 'http://192.168.7.1' }).system.config();
    expect(operationRequests(fake)[0]?.url.href).toBe('http://192.168.7.1/api/system/config');
  });
});
