// Live: every M1 key operation, plus delete, on EHEMTEST keys only. Creates just
// enough keys for a two-page listing and deletes all of them afterwards.
// Findings go to the run log (prefix `[keys]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type HemClient, HemOperationFailedError, type KeyEntry } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys, isTestKey } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[keys] ${label}: ${JSON.stringify(value)}\n`);
}

const hex = (bytes: Uint8Array | undefined): string | undefined => (bytes === undefined ? undefined : [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(''));
const same = (a: Uint8Array | undefined, b: Uint8Array): boolean => a !== undefined && a.length === b.length && a.every((byte, i) => byte === b[i]);

/** Every key matching a search, across all result pages. */
async function searchAll(client: HemClient, descr: Uint8Array, match: 'prefix' | 'suffix' | 'contains'): Promise<KeyEntry[]> {
  const found: KeyEntry[] = [];
  for (let offset = 0; ; ) {
    const page = await client.keys.search({ descr, match, offset, limit: 15 });
    found.push(...page.keys);
    offset += page.keys.length;
    if (page.keys.length === 0 || offset >= page.total) return found;
  }
}

/** Run-unique bytes, so searches cannot hit another run's or a person's keys. */
function uniqueBytes(length: number, tag: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  bytes[0] = tag;
  return bytes;
}

const PAGE = 15;

describeDevice('keys on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let aesKid: string;
  let hmacKid: string;
  let aesLabel: string;
  const aesDescr = uniqueBytes(64, 0xe1);
  const hmacDescr = uniqueBytes(12, 0xe2);
  let existing = 0;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    existing = (await client.keys.listAll()).length;
    aesKid = await keys.create({ type: 'AES256', descr: aesDescr, labelLength: 32 });
    hmacKid = await keys.create({ type: 'SHA2-256', descr: hmacDescr });
    // Fillers: enough keys on the device for a second list page.
    const fillers = Math.max(0, PAGE + 1 - existing - 2);
    for (let i = 0; i < fillers; i += 1) await keys.create({ type: 'AES128' });
    log('setup', { existingKeys: existing, created: keys.created.length, fillers });
  }, 300_000);

  afterAll(async () => {
    await keys?.cleanup();
    const left = (await client.keys.listAll()).filter(isTestKey);
    log('after cleanup, EHEMTEST keys left', left.length);
    expect(left).toEqual([]);
  }, 300_000);

  // verifies: REQ-KEY-001, REQ-API-005
  it('creates an AES256 and a SHA2-256 key that appear in the list; a 32-character label and a 64-byte description come back unchanged', async () => {
    const all = await client.keys.listAll();
    const aes = all.find((key) => key.kid === aesKid);
    const hmac = all.find((key) => key.kid === hmacKid);
    aesLabel = aes?.label ?? '';
    log('created keys as listed', [aes, hmac].map((key) => ({ kid: key?.kid, type: key?.type.raw, label: key?.label, descrBytes: key?.descr?.length })));
    expect(aes?.type.algorithm).toBe('AES256');
    expect(hmac?.type.algorithm).toBe('SHA2-256');
    expect(aes?.label).toHaveLength(32);
    expect(aes?.label.startsWith('EHEMTEST')).toBe(true);
    expect(same(aes?.descr, aesDescr)).toBe(true);
    expect(same(hmac?.descr, hmacDescr)).toBe(true);
  });

  // verifies: REQ-KEY-002
  it('reads a created key back; the fields returned are recorded', async () => {
    const aes = await client.keys.get(aesKid);
    const hmac = await client.keys.get(hmacKid);
    log('get AES256', { fields: Object.keys(aes), type: aes.type?.raw, descr: hex(aes.descr) });
    log('get SHA2-256', { fields: Object.keys(hmac), type: hmac.type?.raw, descr: hex(hmac.descr) });
    expect(aes.updated).toBeTypeOf('number');
    expect(aes.pubkey).toBeUndefined(); // symmetric: no public part
  });

  // verifies: REQ-KEY-003
  it('finds a key by its description; prefix needles of 1, 2 and 3 bytes are probed', async () => {
    const exact = await client.keys.findByDescription(hmacDescr);
    expect(exact.map((key) => key.kid)).toEqual([hmacKid]);

    const probes: Record<string, unknown> = {};
    for (const length of [1, 2, 3, 4, 5, 6]) {
      const found = await searchAll(client, hmacDescr.slice(0, length), 'prefix');
      probes[`${length} byte(s)`] = { matches: found.length, includesKey: found.some((key) => key.kid === hmacKid) };
    }
    const suffix = await searchAll(client, hmacDescr.slice(-3), 'suffix');
    const middle = await searchAll(client, hmacDescr.slice(3, 9), 'contains');
    probes['suffix 3 bytes'] = { matches: suffix.length, includesKey: suffix.some((key) => key.kid === hmacKid) };
    probes['contains 6 bytes at offset 3'] = { matches: middle.length, includesKey: middle.some((key) => key.kid === hmacKid) };
    log('search probes', { descr: hex(hmacDescr), ...probes });
    const none = await client.keys.search({ descr: uniqueBytes(9, 0xe3), match: 'prefix' });
    log('search without match', { total: none.total, listed: none.listed });
    expect(none.keys).toEqual([]);
  });

  // verifies: REQ-KEY-003 — ARCHITECTURE.md §11 risk 10: text or byte comparison? Chosen so the two disagree.
  it('probes whether search compares base64 text or bytes', async () => {
    // base64 of the stored bytes starts "4v//…"; the 1-byte needle e2 is "4g==", which shares no
    // text prefix with it beyond "4"; e2 ff is "4v8=" — "4v8" ≠ "4v/". A text comparison misses these.
    const stored = Uint8Array.from([0xe2, 0xff, 0xff, 0xfe, 0x10, 0x20, ...uniqueBytes(6, 0xe4)]);
    const kid = await keys.create({ type: 'AES128', descr: stored });
    const probe = async (needle: Uint8Array, match: 'prefix' | 'contains'): Promise<boolean> => (await searchAll(client, needle, match)).some((key) => key.kid === kid);
    const result = {
      'prefix e2 (text "^4g==")': await probe(stored.slice(0, 1), 'prefix'),
      'prefix e2 ff (text "^4v8=")': await probe(stored.slice(0, 2), 'prefix'),
      'prefix e2 ff ff (text "^4v//")': await probe(stored.slice(0, 3), 'prefix'),
      'contains ff fe 10 at byte offset 2 (unaligned)': await probe(stored.slice(2, 5), 'contains'),
      'contains fe 10 20 at byte offset 3 (aligned)': await probe(stored.slice(3, 6), 'contains'),
    };
    log('text-or-bytes probe', { stored: hex(stored), ...result });
    expect(result['prefix e2 ff ff (text "^4v//")']).toBe(true);
  });

  // verifies: REQ-KEY-004
  it('lists every key across at least two pages', async () => {
    const first = await client.keys.list({ offset: 0, count: PAGE });
    const second = await client.keys.list({ offset: PAGE, count: PAGE });
    const all = await client.keys.listAll();
    log('pages', { total: first.total, first: first.listed, second: second.listed, deleted: first.deleted, listAll: all.length });
    expect(first.total).toBeGreaterThan(PAGE);
    expect(first.keys).toHaveLength(PAGE);
    expect(second.keys.length).toBeGreaterThan(0);
    expect(all).toHaveLength(first.total);
    expect(new Set(all.map((key) => key.kid)).size).toBe(all.length);
  });

  // verifies: REQ-KEY-005
  it('parses the type string of every key on the device; tokens outside the reference are recorded', async () => {
    const all = await client.keys.listAll();
    const types = [...new Set(all.map((key) => key.type.raw))].sort();
    const unknown = [...new Set(all.flatMap((key) => key.type.unknown))].sort();
    log('type strings on the device', types);
    log('tokens not in the reference', unknown);
    for (const key of all) expect(key.type.algorithm ?? key.type.unknown.length, key.type.raw).toBeTruthy();
  });

  // verifies: REQ-KEY-007
  it('deletes a key: it is gone from the list and a second delete answers 406', async () => {
    const kid = await keys.create({ type: 'AES128' });
    await client.keys.delete(kid);
    const all = await client.keys.listAll();
    expect(all.some((key) => key.kid === kid)).toBe(false);
    const again = await client.keys.delete(kid).catch((e: unknown) => e);
    log('second delete', again instanceof Error ? { name: again.name, status: (again as HemOperationFailedError).status } : again);
    expect(again).toBeInstanceOf(HemOperationFailedError);
    expect(aesLabel).not.toBe(''); // the label check above ran against this run's keys
  });
});
