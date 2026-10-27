// Live: the library's `mode: ECDH` default for SECP keys on create, import and
// derive (ARCHITECTURE.md §6 quirk 11), on EHEMTEST keys only. Findings go to
// the run log (prefix `[secp-mode]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { HemClient, KeyEntry } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[secp-mode] ${label}: ${JSON.stringify(value)}\n`);
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);

/** A local P-256 public key in compressed X9.63 form, as the device takes SECP keys. */
async function localP256Compressed(): Promise<Uint8Array> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'])) as CryptoKeyPair;
  const uncompressed = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)); // 0x04 || x || y, 65 bytes
  const yIsOdd = ((uncompressed[64] as number) & 1) === 1;
  return Uint8Array.from([yIsOdd ? 3 : 2, ...uncompressed.slice(1, 33)]);
}

describeDevice('SECP keys get mode ECDH by default', () => {
  let client: HemClient;
  let keys: TestKeys;
  let peerPub: Uint8Array;
  let p256Kid: string;
  let listed: (kid: string) => Promise<KeyEntry | undefined>;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    peerPub = await localP256Compressed();
    p256Kid = await keys.create({ type: 'SECP256R1' });
    listed = async (kid) => (await client.keys.listAll()).find((key) => key.kid === kid);
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  // verifies: REQ-KEY-001
  it('a SECP256R1 key created without a mode is listed with the ECDH flag and completes an ECDH', async () => {
    const entry = await listed(p256Kid);
    const secret = await client.crypto.ecdh({ kid: p256Kid, peer: { pubkey: peerPub } });
    log('created without mode', { type: entry?.type.raw, secretBytes: secret.length });
    expect(entry?.type.flags).toContain('ECDH');
    expect(entry?.type.flags).not.toContain('ExDSA');
    expect(secret).toHaveLength(32);
  }, 60_000);

  // verifies: REQ-KEY-008
  it('a P-256 public key imported without a mode serves as the stored ECDH peer', async () => {
    const imported = await client.keys.import({ label: keys.label(), pubkey: peerPub, type: 'SECP256R1' });
    keys.track(imported);
    const entry = await listed(imported);
    const viaStored = await client.crypto.ecdh({ kid: p256Kid, peer: { extKid: imported } });
    const viaRaw = await client.crypto.ecdh({ kid: p256Kid, peer: { pubkey: peerPub } });
    log('imported without mode', { type: entry?.type.raw, sameSecret: same(viaStored, viaRaw) });
    expect(entry?.type.flags).toContain('ECDH');
    expect(same(viaStored, viaRaw)).toBe(true);
  }, 60_000);

  // verifies: REQ-KEY-009
  it('records that firmware 1.2.2 refuses a SECP256R1 derive target (the library still sends mode ECDH for it)', async () => {
    // Probed on 2026-10-27 with no mode, ECDH and ECDH,ExDSA, from X25519 and
    // P-256 sources: always 406, while CURVE25519, ED25519, AES and SHA targets
    // derive. A second derivation from the same material is a 406 duplicate
    // (quirk 12), so each case below uses fresh material.
    const refused = await client.keys.derive({ kid: p256Kid, label: keys.label(), type: 'SECP256R1', peer: { pubkey: peerPub } }).then(
      (kid) => { keys.track(kid); return { kind: 'derived' as const, kid }; },
      (error: unknown) => ({ kind: 'error' as const, name: (error as Error).name, status: (error as { status?: number }).status }),
    );
    const control = await client.keys.derive({ kid: p256Kid, label: keys.label(), type: 'CURVE25519', peer: { pubkey: peerPub } });
    keys.track(control);
    const entry = await listed(control);
    log('derive SECP256R1 target without mode', refused);
    log('derive CURVE25519 target from the same source', { type: entry?.type.raw });
    expect(refused).toEqual({ kind: 'error', name: 'HemOperationFailedError', status: 406 });
    expect(entry?.type.flags).toContain('ECDH');
  }, 60_000);

  // verifies: REQ-KEY-001
  it('an explicit mode is kept: ExDSA gives a key without the ECDH flag', async () => {
    const signer = await keys.create({ type: 'SECP256R1', mode: 'ExDSA' });
    const entry = await listed(signer);
    log('created with mode ExDSA', { type: entry?.type.raw });
    expect(entry?.type.flags).toContain('ExDSA');
    expect(entry?.type.flags).not.toContain('ECDH');
  }, 60_000);
});
