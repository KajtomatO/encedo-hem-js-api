// Live: ML-KEM encaps/decaps and ML-DSA sign/verify on EHEMTEST keys only, plus
// the probe of what a failed ML-DSA verification looks like through the Node
// transport (ARCHITECTURE.md §6 quirk 3, §11 risk 2). Findings go to the run log
// (prefix `[pqc]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { invoke } from '../../src/api/core.js';
import { CRYPTO_MLDSA_VERIFY, CRYPTO_MLKEM_DECAPS } from '../../src/api/crypto.js';
import { contextOf } from '../../src/client.js';
import { type HemClient, HemError } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[pqc] ${label}: ${JSON.stringify(value)}\n`);
}

const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);
const MSG = new TextEncoder().encode('EHEMTEST post-quantum 2026-10-27');
const KEYGEN_TIMEOUT = 180_000;

describeDevice('ML-KEM and ML-DSA on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let kemKid: string;
  let dsaKid: string;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    const t0 = Date.now();
    kemKid = await client.keys.create({ label: keys.label(), type: 'MLKEM768' }, { timeoutMs: KEYGEN_TIMEOUT });
    keys.track(kemKid);
    const t1 = Date.now();
    dsaKid = await client.keys.create({ label: keys.label(), type: 'MLDSA65' }, { timeoutMs: KEYGEN_TIMEOUT });
    keys.track(dsaKid);
    const t2 = Date.now();
    log('key generation ms', { MLKEM768: t1 - t0, MLDSA65: t2 - t1 });
  }, KEYGEN_TIMEOUT * 2 + 10_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  // verifies: REQ-OPS-011, REQ-OPS-012
  it('encapsulates and decapsulates to the same 32-byte secret; lengths and the decaps alg field recorded', async () => {
    const encapsulated = await client.crypto.mlkemEncaps({ kid: kemKid });
    const secret = await client.crypto.mlkemDecaps({ kid: kemKid, ct: encapsulated.ciphertext });
    log('ML-KEM', { alg: encapsulated.alg, ssBytes: encapsulated.sharedSecret.length, ctBytes: encapsulated.ciphertext.length, decapsBytes: secret.length, equal: same(secret, encapsulated.sharedSecret) });
    expect(encapsulated.sharedSecret).toHaveLength(32);
    expect(encapsulated.ciphertext).toHaveLength(1088);
    expect(same(secret, encapsulated.sharedSecret)).toBe(true);

    const raw = await invoke(contextOf(client), CRYPTO_MLKEM_DECAPS, { params: { kid: kemKid }, body: { kid: kemKid, ct: b64(encapsulated.ciphertext) } });
    log('ML-KEM decaps raw alg field (quirk 2)', { alg: raw['alg'], fields: Object.keys(raw) });

    const tampered = Uint8Array.from(encapsulated.ciphertext);
    tampered[0] = (tampered[0] as number) ^ 0xff;
    const other = await client.crypto.mlkemDecaps({ kid: kemKid, ct: tampered }).then(
      (s) => ({ outcome: 'secret', equal: same(s, encapsulated.sharedSecret) }),
      (error: unknown) => ({ outcome: `${(error as Error).name} ${(error as { status?: number }).status ?? ''}` }),
    );
    log('ML-KEM decaps of a tampered ciphertext (implicit rejection expected: a different secret)', other);
  }, 120_000);

  // verifies: REQ-OPS-013, REQ-OPS-014
  it('signs with ML-DSA-65; the signature verifies as true on the device', async () => {
    const signed = await client.crypto.mldsaSign({ kid: dsaKid, msg: MSG });
    log('ML-DSA sign', { alg: signed.alg, signatureBytes: signed.signature.length });
    expect(signed.signature).toHaveLength(3309);
    expect(await client.crypto.mldsaVerify({ kid: dsaKid, msg: MSG, sign: signed.signature })).toBe(true);
    const withCtx = await client.crypto.mldsaSign({ kid: dsaKid, msg: MSG, ctx: new TextEncoder().encode('EHEMTEST') });
    const ctxOk = await client.crypto.mldsaVerify({ kid: dsaKid, msg: MSG, sign: withCtx.signature, ctx: new TextEncoder().encode('EHEMTEST') });
    const ctxMissing = await client.crypto.mldsaVerify({ kid: dsaKid, msg: MSG, sign: withCtx.signature });
    log('ML-DSA with context', { signatureBytes: withCtx.signature.length, verifiesWithCtx: ctxOk, verifiesWithoutCtx: ctxMissing });
  }, 120_000);

  // verifies: REQ-OPS-014
  it('a bad signature: records what the Node transport reports, and that the library answers false', async () => {
    const signed = await client.crypto.mldsaSign({ kid: dsaKid, msg: MSG });
    const bad = Uint8Array.from(signed.signature);
    bad[100] = (bad[100] as number) ^ 0x01;
    const t0 = Date.now();
    const raw = await invoke(contextOf(client), CRYPTO_MLDSA_VERIFY, { params: { kid: dsaKid }, body: { kid: dsaKid, msg: b64(MSG), sign: b64(bad) } }).then(
      () => ({ kind: 'success' as const }),
      (error: unknown) => ({
        kind: 'error' as const,
        name: (error as Error).name,
        status: error instanceof HemError ? error.status : undefined,
        message: (error as Error).message,
        cause: error instanceof HemError && error.cause instanceof Error ? `${error.cause.name}: ${error.cause.message}` : undefined,
      }),
    );
    log('bad ML-DSA signature through the transport', { ...raw, ms: Date.now() - t0 });
    const wrongMessage = await client.crypto.mldsaVerify({ kid: dsaKid, msg: new TextEncoder().encode('EHEMTEST other'), sign: signed.signature });
    const result = await client.crypto.mldsaVerify({ kid: dsaKid, msg: MSG, sign: bad });
    log('library mldsaVerify', { badSignature: result, wrongMessage });
    expect(result).toBe(false);
    expect(wrongMessage).toBe(false);
  }, 120_000);
});
