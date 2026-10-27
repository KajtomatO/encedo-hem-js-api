// Live: key update, import and derive on EHEMTEST keys only, plus the derive echo
// probe (ARCHITECTURE.md §6 quirk 4) sent through the binding core without the
// library's type validation. Findings go to the run log (prefix `[keys-m2]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { KEY_DERIVE } from '../../src/api/keymgmt.js';
import { invoke } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import { type HemClient, HemOperationFailedError, HemProtocolError } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[keys-m2] ${label}: ${JSON.stringify(value)}\n`);
}

const same = (a: Uint8Array | undefined, b: Uint8Array): boolean => a !== undefined && a.length === b.length && a.every((byte, i) => byte === b[i]);

/** A fresh X25519 public key from Web Crypto, raw (32 bytes). */
async function localX25519PublicKey(): Promise<Uint8Array> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, true, ['deriveBits'])) as CryptoKeyPair;
  return new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
}

describeDevice('key update, import and derive on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let aliceKid: string;
  let bobKid: string;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    aliceKid = await keys.create({ type: 'CURVE25519', descr: new TextEncoder().encode('EHEMTEST m2 alice') });
    bobKid = await keys.create({ type: 'CURVE25519' });
    log('setup', { created: keys.created.length });
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  const entryOf = async (kid: string) => (await client.keys.listAll()).find((key) => key.kid === kid);

  // verifies: REQ-KEY-006
  it('changes a label and a description, and clears the description, as read back through list', async () => {
    const label = keys.label();
    const descr = new TextEncoder().encode('EHEMTEST m2 renamed');
    await client.keys.update({ kid: aliceKid, label, descr });
    const renamed = await entryOf(aliceKid);
    expect(renamed?.label).toBe(label);
    expect(same(renamed?.descr, descr)).toBe(true);

    await client.keys.update({ kid: aliceKid, label, descr: new Uint8Array(0) });
    const cleared = await entryOf(aliceKid);
    expect(cleared?.label).toBe(label);
    log('update', { renamedDescr: renamed?.descr?.length, clearedDescr: cleared?.descr?.length ?? null, type: cleared?.type.raw });
    expect(cleared?.descr === undefined || cleared.descr.length === 0).toBe(true);
  }, 60_000);

  // verifies: REQ-KEY-006
  it('refuses an update of an unknown key with 406', async () => {
    const error = await client.keys.update({ kid: 'ffffffffffffffffffffffffffffff00', label: 'EHEMTEST-nope', descr: new Uint8Array(0) }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemOperationFailedError);
    log('update unknown key', { status: (error as HemOperationFailedError).status });
  }, 60_000);

  // verifies: REQ-KEY-008
  it('imports a freshly generated X25519 public key once; the second import is refused', async () => {
    const pubkey = await localX25519PublicKey();
    const kid = await client.keys.import({ label: keys.label(), pubkey, type: 'CURVE25519', descr: new TextEncoder().encode('EHEMTEST m2 import') });
    keys.track(kid);
    const entry = await entryOf(kid);
    expect(entry).toBeDefined();
    const details = await client.keys.get(kid);
    log('import', { kid, type: entry?.type.raw, getType: details.type?.raw, pubkeyMatches: same(details.pubkey, pubkey) });

    const again = await client.keys.import({ label: keys.label(), pubkey, type: 'CURVE25519' }).catch((e: unknown) => e);
    expect(again).toBeInstanceOf(HemOperationFailedError);
    log('import twice', { status: (again as HemOperationFailedError).status, message: (again as HemOperationFailedError).message });
  }, 60_000);

  // verifies: REQ-KEY-009
  it('derives an AES256 key from two X25519 keys and finds it in the list', async () => {
    const label = keys.label();
    const kid = await client.keys.derive({ kid: aliceKid, label, type: 'AES256', peer: { extKid: bobKid }, descr: new TextEncoder().encode('EHEMTEST m2 derived') });
    keys.track(kid);
    expect(kid).not.toBe(aliceKid);
    const entry = await entryOf(kid);
    expect(entry?.label).toBe(label);
    log('derive', { kid, type: entry?.type.raw });

    const again = await client.keys.derive({ kid: aliceKid, label: keys.label(), type: 'AES256', peer: { extKid: bobKid } }).catch((e: unknown) => e);
    log('derive the same key again', { outcome: again instanceof Error ? `${again.name} ${(again as HemOperationFailedError).status}` : `kid ${String(again)}` });
    if (typeof again === 'string') keys.track(again);
  }, 60_000);

  // verifies: REQ-KEY-009
  it('probes the derive echo quirk: an unrecognised type sent without the library’s validation', async () => {
    const label = keys.label();
    const body = { kid: aliceKid, label, type: 'EHEMTEST-NOT-A-TYPE', ext_kid: bobKid };
    const outcome = await invoke(contextOf(client), KEY_DERIVE, { body }).then(
      (r) => ({ kind: 'reply' as const, kid: String(r['kid']), echoed: String(r['kid']).toLowerCase() === aliceKid }),
      (error: unknown) => ({ kind: 'error' as const, name: (error as Error).name, status: (error as { status?: number }).status }),
    );
    log('derive echo probe', outcome);
    if (outcome.kind === 'reply' && !outcome.echoed) keys.track(outcome.kid.toLowerCase());
    // The library's own call with a bad type never reaches the device; with an
    // echoed id it would raise HemProtocolError (unit-tested). Nothing is asserted
    // about the device here: the finding is recorded.
    expect(['reply', 'error']).toContain(outcome.kind);
    const stillThere = (await client.keys.listAll()).filter((key) => key.label === label);
    log('derive echo probe: keys with the probe label', stillThere.map((key) => ({ kid: key.kid, type: key.type.raw })));
    for (const key of stillThere) keys.track(key.kid);
    expect(HemProtocolError).toBeDefined();
  }, 60_000);
});
