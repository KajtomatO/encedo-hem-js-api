import { describe, expect, it } from 'vitest';
import { HemClient, HemProtocolError } from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const base = { ctx: 3, uptime: 1234, temp: 31.5, fls_state: 0 };
const clientWith = (fake: FakeFetch, url = 'https://my.ence.do'): HemClient => new HemClient({ url, fetch: fake.fetch });

describe('system.status', () => {
  // verifies: REQ-SYS-001
  it('sends GET /api/system/status with no header and no body', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: base });
    await clientWith(fake).system.status();
    expect(fake.last.method).toBe('GET');
    expect(fake.last.url.href).toBe('https://my.ence.do/api/system/status');
    expect(fake.last.headers).toEqual({});
    expect(fake.last.body).toBeUndefined();
  });

  // verifies: REQ-SYS-001
  it('maps a minimal response of an initialised device with the clock unset', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: base });
    expect(await clientWith(fake).system.status()).toEqual({
      initialised: true,
      clockSet: false,
      ctx: 3,
      uptime: 1234,
      temp: 31.5,
      flsState: 0,
      trustedTime: true,
      fwUpgrade: false,
    });
  });

  // verifies: REQ-SYS-001
  it('reports the clock set when ts or time is present, and maps every conditional field', async () => {
    const full = {
      ...base,
      inited: false,
      https: true,
      hostname: 'my.ence.do',
      tts: false,
      ts: '2026-10-05T12:00:00Z',
      time: 1791201600,
      storage: ['1024:rw', '0:-'],
      format: 'done',
      fw_upgrade: true,
      fls_state: 4,
      unknown_future_field: 1,
    };
    const fake = new FakeFetch()
      .on('GET', '/api/system/status', { body: full }, { body: { ...base, ts: '2026-10-05T12:00:00Z' } }, { body: { ...base, time: 5 } });
    const client = clientWith(fake, 'http://192.168.7.1');
    expect(await client.system.status()).toEqual({
      initialised: false,
      clockSet: true,
      time: 1791201600,
      ts: '2026-10-05T12:00:00Z',
      ctx: 3,
      uptime: 1234,
      temp: 31.5,
      flsState: 4,
      trustedTime: false,
      fwUpgrade: true,
      https: true,
      hostname: 'my.ence.do',
      storage: ['1024:rw', '0:-'],
      format: 'done',
    });
    expect((await client.system.status()).clockSet).toBe(true);
    expect((await client.system.status()).clockSet).toBe(true);
  });

  // verifies: REQ-SYS-001
  it.each(['ctx', 'uptime', 'temp', 'fls_state'])('requires %s', async (field) => {
    const body: Record<string, unknown> = { ...base };
    delete body[field];
    const fake = new FakeFetch().on('GET', '/api/system/status', { body });
    const error = await clientWith(fake).system.status().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemProtocolError);
    expect((error as Error).message).toContain(field);
  });

  it('rejects a field of the wrong type, naming it', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: { ...base, uptime: '12' } });
    await expect(clientWith(fake).system.status()).rejects.toThrow(/"uptime"/);
  });
});

describe('system.version', () => {
  const version = {
    hwv: 'PPA rev 2.2',
    fwv: 'HEM-1.2.2',
    fwk: 'AAECAw==',
    fws: '-_-_',
  };

  // verifies: REQ-SYS-002
  it('sends GET /api/system/version with no header and returns strings and bytes', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/version', { body: version });
    expect(await clientWith(fake).system.version()).toEqual({
      hwv: 'PPA rev 2.2',
      fwv: 'HEM-1.2.2',
      fwk: Uint8Array.from([0, 1, 2, 3]),
      fws: Uint8Array.from([0xfb, 0xff, 0xbf]),
    });
    expect(fake.last.method).toBe('GET');
    expect(fake.last.path).toBe('/api/system/version');
    expect(fake.last.headers).toEqual({});
    expect(fake.last.body).toBeUndefined();
  });

  // verifies: REQ-SYS-002, REQ-API-004
  it('includes the conditional fields when sent, binary ones as bytes', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/version', {
      body: { ...version, blv: 'BL-1.0', blk: 'BAU=', bls: 'Bgc', sd_csd: '00ff', sd_cid: 'AB12', uis: 'CAk=' },
    });
    expect(await clientWith(fake).system.version()).toEqual({
      hwv: 'PPA rev 2.2',
      fwv: 'HEM-1.2.2',
      fwk: Uint8Array.from([0, 1, 2, 3]),
      fws: Uint8Array.from([0xfb, 0xff, 0xbf]),
      blv: 'BL-1.0',
      blk: Uint8Array.from([4, 5]),
      bls: Uint8Array.from([6, 7]),
      sdCsd: Uint8Array.from([0x00, 0xff]),
      sdCid: Uint8Array.from([0xab, 0x12]),
      uis: Uint8Array.from([8, 9]),
    });
  });

  // verifies: REQ-SYS-002
  it.each(['hwv', 'fwv', 'fwk', 'fws'])('requires %s', async (field) => {
    const body: Record<string, unknown> = { ...version };
    delete body[field];
    const fake = new FakeFetch().on('GET', '/api/system/version', { body });
    await expect(clientWith(fake).system.version()).rejects.toThrow(HemProtocolError);
  });

  it('rejects malformed base64 in a binary field, naming it', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/version', { body: { ...version, fwk: 'not base64!' } });
    await expect(clientWith(fake).system.version()).rejects.toThrow(/"fwk"/);
  });
});
