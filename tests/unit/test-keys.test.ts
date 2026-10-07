// The test-key helper, exercised against the fake device: labels, tracking,
// cleanup after a failed body, and a sweep that touches only EHEMTEST keys.
import { describe, expect, it } from 'vitest';
import { loggedInClient, loginDevice } from '../support/device.js';
import { TEST_LABEL_PREFIX, TestKeys, isTestKey, sweepTestKeys } from '../support/test-keys.js';

const K1 = '11111111111111111111111111111111';
const K2 = '22222222222222222222222222222222';
const K3 = '33333333333333333333333333333333';
const NOW = (): number => 1_700_000_000_000;

function entry(kid: string, label: string): Record<string, unknown> {
  return { kid, created: 1, type: 'PKEY,AES256', label, updated: 2 };
}

describe('test-key labels', () => {
  // verifies: REQ-TEST-006
  it('are EHEMTEST-<unix seconds>-<n>, unique within a run and never longer than 32 characters', () => {
    const keys = new TestKeys(loggedInClient(loginDevice()), NOW);
    const a = keys.label();
    const b = keys.label();
    expect(a).toBe('EHEMTEST-1700000000-1');
    expect(b).toBe('EHEMTEST-1700000000-2');
    expect(a.startsWith(TEST_LABEL_PREFIX)).toBe(true);
    expect(keys.label(32)).toHaveLength(32);
    expect(keys.label(32)).toMatch(/^EHEMTEST-1700000000-4x+$/);
    expect(() => keys.label(33)).toThrow(RangeError);
    expect(() => keys.label(10)).toThrow(RangeError);
  });

  // verifies: REQ-TEST-006
  it('tell test keys from every other label, case-sensitively', () => {
    expect(isTestKey({ label: 'EHEMTEST-1-1' })).toBe(true);
    expect(isTestKey({ label: 'EHEMTESTx' })).toBe(true);
    expect(isTestKey({ label: 'ehemtest-1-1' })).toBe(false);
    expect(isTestKey({ label: 'TLS PrivateKey' })).toBe(false);
    expect(isTestKey({ label: 'My phone (iPhone)' })).toBe(false);
  });
});

describe('TestKeys.create and cleanup', () => {
  // verifies: REQ-TEST-006
  it('creates with a generated label, remembers the key id, and deletes it on cleanup', async () => {
    const fake = loginDevice().on('POST', '/api/keymgmt/create', { body: { kid: K1 } }).always('DELETE', /^\/api\/keymgmt\/delete\//, { status: 200 });
    const keys = new TestKeys(loggedInClient(fake), NOW);
    const kid = await keys.create({ type: 'AES256', labelLength: 32 });
    expect(kid).toBe(K1);
    expect(keys.created).toEqual([K1]);
    const label = (fake.requestsTo('POST', '/api/keymgmt/create')[0]?.json() as { label: string }).label;
    expect(label).toMatch(/^EHEMTEST-/);
    expect(label).toHaveLength(32);

    await keys.cleanup();
    expect(fake.requestsTo('DELETE', `/api/keymgmt/delete/${K1}`)).toHaveLength(1);
    expect(keys.created).toEqual([]);
  });

  // verifies: REQ-TEST-006
  it('tolerates a key that is already gone, tries every key, and reports the real failures afterwards', async () => {
    const fake = loginDevice()
      .on('DELETE', `/api/keymgmt/delete/${K1}`, { status: 406 })
      .on('DELETE', `/api/keymgmt/delete/${K2}`, { status: 500 })
      .on('DELETE', `/api/keymgmt/delete/${K3}`, { status: 200 });
    const keys = new TestKeys(loggedInClient(fake), NOW);
    keys.track(K1);
    keys.track(K2);
    keys.track(K3);
    await expect(keys.cleanup()).rejects.toThrow(new RegExp(`cleanup failed for ${K2}`));
    expect(fake.requestsTo('DELETE', /^\/api\/keymgmt\/delete\//).map((r) => r.path)).toEqual([
      `/api/keymgmt/delete/${K1}`,
      `/api/keymgmt/delete/${K2}`,
      `/api/keymgmt/delete/${K3}`,
    ]);
    expect(keys.created).toEqual([]);
  });
});

describe('sweepTestKeys', () => {
  // verifies: REQ-TEST-006, REQ-TEST-005
  it('deletes every EHEMTEST key across all pages and nothing else', async () => {
    const page1 = {
      offset: 0,
      total: 16,
      listed: 15,
      list: [
        entry(K1, 'EHEMTEST-1-1'),
        entry('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'TLS PrivateKey'),
        entry('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'TLS Certificate'),
        entry('cccccccccccccccccccccccccccccccc', 'My phone (iPhone)'),
        entry('dddddddddddddddddddddddddddddddd', 'tenant-42'),
        entry('eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'ehemtest-lower'),
        ...Array.from({ length: 9 }, (_, i) => entry(`${String(i).repeat(32)}`.slice(0, 32).replace(/./g, (c) => (c === '0' ? 'f' : c)), `other-${i}`)),
      ],
    };
    const page2 = { offset: 15, total: 16, listed: 1, list: [entry(K2, 'EHEMTESTleftover')] };
    const fake = loginDevice()
      .on('GET', '/api/keymgmt/list/0/15', { body: page1 })
      .on('GET', '/api/keymgmt/list/15/15', { body: page2 })
      .always('DELETE', /^\/api\/keymgmt\/delete\//, { status: 200 });

    const swept = await sweepTestKeys(loggedInClient(fake));

    expect(swept).toEqual([K1, K2]);
    expect(fake.requestsTo('DELETE', /^\/api\/keymgmt\/delete\//).map((r) => r.path)).toEqual([`/api/keymgmt/delete/${K1}`, `/api/keymgmt/delete/${K2}`]);
  });

  // verifies: REQ-TEST-006
  it('deletes nothing on a device without test keys', async () => {
    const fake = loginDevice().on('GET', '/api/keymgmt/list/0/15', { body: { offset: 0, total: 1, listed: 1, list: [entry(K3, 'tenant-42')] } });
    expect(await sweepTestKeys(loggedInClient(fake))).toEqual([]);
    expect(fake.requestsTo('DELETE', /^\/api\/keymgmt\/delete\//)).toHaveLength(0);
  });
});
