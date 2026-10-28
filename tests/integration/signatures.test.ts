// Live: HMAC verify, ExDSA sign and verify on EHEMTEST keys only; the device's
// signatures are also verified locally with Web Crypto. Findings go to the run
// log (prefix `[sig]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { HemClient } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[sig] ${label}: ${JSON.stringify(value)}\n`);
}

/** A copy backed by a plain ArrayBuffer, as Web Crypto's typings want. */
const buf = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
const hex = (bytes: Uint8Array): string => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const MSG = new TextEncoder().encode('EHEMTEST signatures 2026-10-27');
const OTHER = new TextEncoder().encode('EHEMTEST another message');

// ----- P-256 helpers: decompress an X9.63 public key, convert a DER ECDSA signature to r||s -----

const P = (1n << 256n) - (1n << 224n) + (1n << 192n) + (1n << 96n) - 1n;
const B = 0x5ac635d8aa3a93e7b3ebbd55769886bc651d06b0cc53b0f63bce3c3e27d2604bn;

function modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
  let result = 1n;
  let b = base % modulus;
  let e = exponent;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % modulus;
    b = (b * b) % modulus;
    e >>= 1n;
  }
  return result;
}

const toBytes32 = (value: bigint): Uint8Array => Uint8Array.from(value.toString(16).padStart(64, '0').match(/../g) as string[], (h) => parseInt(h, 16));

/** Compressed X9.63 (33 bytes) → uncompressed (65 bytes), for Web Crypto's raw import. */
function decompressP256(compressed: Uint8Array): Uint8Array {
  expect(compressed.length).toBe(33);
  const prefix = compressed[0] as number;
  expect([2, 3]).toContain(prefix);
  const x = BigInt(`0x${hex(compressed.slice(1))}`);
  const rhs = (modPow(x, 3n, P) - 3n * x + B) % P;
  let y = modPow((rhs + P) % P, (P + 1n) / 4n, P); // P ≡ 3 (mod 4)
  if ((y & 1n) !== BigInt(prefix & 1)) y = P - y;
  return Uint8Array.from([4, ...toBytes32(x), ...toBytes32(y)]);
}

/** DER SEQUENCE { INTEGER r, INTEGER s } → r||s (64 bytes). Returns undefined if the input is not DER. */
function derToRaw(der: Uint8Array): Uint8Array | undefined {
  if (der[0] !== 0x30) return undefined;
  let offset = 2;
  const readInt = (): Uint8Array | undefined => {
    if (der[offset] !== 0x02) return undefined;
    const length = der[offset + 1] as number;
    let value = der.slice(offset + 2, offset + 2 + length);
    offset += 2 + length;
    while (value.length > 32 && value[0] === 0) value = value.slice(1);
    const out = new Uint8Array(32);
    out.set(value, 32 - value.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  if (!r || !s) return undefined;
  return Uint8Array.from([...r, ...s]);
}

describeDevice('signatures and MACs on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let hmacKid: string;
  let p256Kid: string;
  let edKid: string;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    hmacKid = await keys.create({ type: 'SHA2-256' });
    p256Kid = await keys.create({ type: 'SECP256R1', mode: 'ExDSA' });
    edKid = await keys.create({ type: 'ED25519' });
    log('setup', { created: keys.created.length });
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  // verifies: REQ-OPS-005
  it('verifies the device’s own MAC as true and an altered one as false', async () => {
    const mac = await client.crypto.hmac({ kid: hmacKid, msg: MSG });
    expect(mac).toHaveLength(32);
    expect(await client.crypto.hmacVerify({ kid: hmacKid, msg: MSG, mac })).toBe(true);
    const altered = Uint8Array.from(mac);
    altered[0] = (altered[0] as number) ^ 0x01;
    expect(await client.crypto.hmacVerify({ kid: hmacKid, msg: MSG, mac: altered })).toBe(false);
    expect(await client.crypto.hmacVerify({ kid: hmacKid, msg: OTHER, mac })).toBe(false);
    log('hmacVerify', { macBytes: mac.length, ownMac: true, alteredMac: false, otherMessage: false });
  }, 60_000);

  // verifies: REQ-OPS-006, REQ-OPS-007
  it('signs with a P-256 key: DER-encoded, verifies locally with Web Crypto and on the device', async () => {
    const signature = await client.crypto.sign({ kid: p256Kid, msg: MSG, alg: 'SHA256WithECDSA' });
    const raw = derToRaw(signature);
    log('P-256 signature', { bytes: signature.length, firstByte: signature[0], der: raw !== undefined });
    expect(raw, 'ECDSA signature is DER').toBeDefined();

    const details = await client.keys.get(p256Kid);
    expect(details.pubkey).toBeDefined();
    const uncompressed = decompressP256(details.pubkey as Uint8Array);
    const publicKey = await crypto.subtle.importKey('raw', buf(uncompressed), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const locally = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, publicKey, buf(raw as Uint8Array), buf(MSG));
    log('P-256 local verification', { pubkeyBytes: details.pubkey?.length, verified: locally });
    expect(locally).toBe(true);

    expect(await client.crypto.verify({ kid: p256Kid, msg: MSG, sign: signature, alg: 'SHA256WithECDSA' })).toBe(true);
    expect(await client.crypto.verify({ kid: p256Kid, msg: OTHER, sign: signature, alg: 'SHA256WithECDSA' })).toBe(false);
  }, 60_000);

  // verifies: REQ-OPS-006, REQ-OPS-007
  it('signs with an Ed25519 key: raw 64 bytes, verifies locally with Web Crypto and on the device', async () => {
    const signature = await client.crypto.sign({ kid: edKid, msg: MSG, alg: 'Ed25519' });
    log('Ed25519 signature', { bytes: signature.length });
    expect(signature).toHaveLength(64);

    const details = await client.keys.get(edKid);
    const publicKey = await crypto.subtle.importKey('raw', buf(details.pubkey as Uint8Array), { name: 'Ed25519' }, false, ['verify']);
    const locally = await crypto.subtle.verify({ name: 'Ed25519' }, publicKey, buf(signature), buf(MSG));
    log('Ed25519 local verification', { pubkeyBytes: details.pubkey?.length, verified: locally });
    expect(locally).toBe(true);

    expect(await client.crypto.verify({ kid: edKid, msg: MSG, sign: signature, alg: 'Ed25519' })).toBe(true);
    expect(await client.crypto.verify({ kid: edKid, msg: OTHER, sign: signature, alg: 'Ed25519' })).toBe(false);
  }, 60_000);

  // verifies: REQ-OPS-006
  it('records what the device answers for a context variant and for a key without the ExDSA mode', async () => {
    const ctxSignature = await client.crypto.sign({ kid: edKid, msg: MSG, alg: 'Ed25519ctx', ctx: new TextEncoder().encode('EHEMTEST') }).then(
      (s) => ({ ok: true, bytes: s.length }),
      (error: unknown) => ({ ok: false, error: `${(error as Error).name} ${(error as { status?: number }).status ?? ''}` }),
    );
    log('Ed25519ctx', ctxSignature);
    const ecdhOnly = await keys.create({ type: 'SECP256R1' });
    const refused = await client.crypto.sign({ kid: ecdhOnly, msg: MSG, alg: 'SHA256WithECDSA' }).then(
      () => 'signed',
      (error: unknown) => `${(error as Error).name} ${(error as { status?: number }).status ?? ''}`,
    );
    log('sign with an ECDH-only SECP256R1 key (quirk 11)', refused);
  }, 60_000);
});
