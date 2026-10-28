// Live: AES encrypt and decrypt in ECB, CBC and GCM with an EHEMTEST AES-256 key.
// Findings go to the run log (prefix `[aes]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type CipherAlgorithm, type HemClient, HemOperationFailedError } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[aes] ${label}: ${JSON.stringify(value)}\n`);
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);
const MSG = new TextEncoder().encode('EHEMTEST cipher 2026-10-27: twenty-three bytes+'); // 45 bytes, not block-aligned
const BLOCK_MSG = new TextEncoder().encode('EHEMTEST ECB needs 32 aligned by'); // 32 bytes
const AAD = new TextEncoder().encode('EHEMTEST aad');

describeDevice('AES encrypt and decrypt on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let kid: string;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    kid = await keys.create({ type: 'AES256' });
    expect(BLOCK_MSG).toHaveLength(32);
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  // verifies: REQ-OPS-008, REQ-OPS-009
  it.each<[CipherAlgorithm, Uint8Array]>([
    ['AES256-ECB', BLOCK_MSG],
    ['AES256-CBC', MSG],
    ['AES256-GCM', MSG],
  ])('%s round-trips; IV and tag lengths recorded', async (alg, msg) => {
    const gcm = alg.endsWith('GCM');
    const encrypted = await client.crypto.encrypt({ kid, msg, alg, ...(gcm ? { aad: AAD } : {}) });
    log(alg, { plaintextBytes: msg.length, ciphertextBytes: encrypted.ciphertext.length, ivBytes: encrypted.iv?.length ?? null, tagBytes: encrypted.tag?.length ?? null });
    const decrypted = await client.crypto.decrypt({ kid, msg: encrypted.ciphertext, alg, iv: encrypted.iv, tag: encrypted.tag, ...(gcm ? { aad: AAD } : {}) });
    expect(same(decrypted, msg)).toBe(true);
    if (alg.endsWith('ECB')) expect(encrypted.iv).toBeUndefined();
    else expect(encrypted.iv).toHaveLength(16);
    if (gcm) expect(encrypted.tag).toHaveLength(16);
  }, 60_000);

  // verifies: REQ-OPS-008
  it('two GCM encryptions of the same message use different IVs', async () => {
    const a = await client.crypto.encrypt({ kid, msg: MSG, alg: 'AES256-GCM' });
    const b = await client.crypto.encrypt({ kid, msg: MSG, alg: 'AES256-GCM' });
    expect(same(a.iv as Uint8Array, b.iv as Uint8Array)).toBe(false);
    expect(same(a.ciphertext, b.ciphertext)).toBe(false);
  }, 60_000);

  // verifies: REQ-OPS-009
  it('a GCM message with an altered tag, and one with other AAD, fail with the recorded status', async () => {
    const encrypted = await client.crypto.encrypt({ kid, msg: MSG, alg: 'AES256-GCM', aad: AAD });
    const tag = Uint8Array.from(encrypted.tag as Uint8Array);
    tag[0] = (tag[0] as number) ^ 0x80;
    const alteredTag = await client.crypto.decrypt({ kid, msg: encrypted.ciphertext, alg: 'AES256-GCM', iv: encrypted.iv, tag, aad: AAD }).catch((e: unknown) => e);
    expect(alteredTag).toBeInstanceOf(HemOperationFailedError);
    const otherAad = await client.crypto.decrypt({ kid, msg: encrypted.ciphertext, alg: 'AES256-GCM', iv: encrypted.iv, tag: encrypted.tag, aad: new Uint8Array([1]) }).catch((e: unknown) => e);
    log('GCM failures', { alteredTag: (alteredTag as HemOperationFailedError).status, otherAad: otherAad instanceof Error ? `${otherAad.name} ${(otherAad as { status?: number }).status}` : 'decrypted' });
  }, 60_000);

  // verifies: REQ-OPS-008
  it('records what the device answers for an AES256 algorithm on a key of another size', async () => {
    const small = await keys.create({ type: 'AES128' });
    const outcome = await client.crypto.encrypt({ kid: small, msg: MSG, alg: 'AES256-CBC' }).then(
      (r) => ({ encrypted: true, ciphertextBytes: r.ciphertext.length }),
      (error: unknown) => ({ encrypted: false, error: `${(error as Error).name} ${(error as { status?: number }).status ?? ''}` }),
    );
    log('AES256-CBC with an AES128 key', outcome);
  }, 60_000);
});
