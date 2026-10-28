// Live: ECDH against a locally generated peer, and the ECDH-agreed key mode of
// encrypt/decrypt and HMAC, on EHEMTEST keys only. Findings go to the run log
// (prefix `[ecdh]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import type { HemClient } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[ecdh] ${label}: ${JSON.stringify(value)}\n`);
}

const buf = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);
const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);
const MSG = new TextEncoder().encode('EHEMTEST agreed key 2026-10-27');

interface LocalPeer {
  publicKey: Uint8Array;
  secretWith: (devicePublicKey: Uint8Array) => Promise<Uint8Array>;
}

async function localX25519(): Promise<LocalPeer> {
  const pair = (await crypto.subtle.generateKey({ name: 'X25519' }, false, ['deriveBits'])) as CryptoKeyPair;
  return {
    publicKey: new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)),
    secretWith: async (devicePublicKey) => {
      const peer = await crypto.subtle.importKey('raw', buf(devicePublicKey), { name: 'X25519' }, false, []);
      return new Uint8Array(await crypto.subtle.deriveBits({ name: 'X25519', public: peer }, pair.privateKey, 256));
    },
  };
}

/** A local P-384 public key in compressed X9.63 form (as the device takes SECP keys) and uncompressed. */
async function localP384(): Promise<{ compressed: Uint8Array; uncompressed: Uint8Array }> {
  const pair = (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-384' }, false, ['deriveBits'])) as CryptoKeyPair;
  const uncompressed = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey)); // 0x04 || x || y, 97 bytes
  const x = uncompressed.slice(1, 49);
  const yIsOdd = ((uncompressed[96] as number) & 1) === 1;
  return { compressed: Uint8Array.from([yIsOdd ? 3 : 2, ...x]), uncompressed };
}

describeDevice('ECDH and the agreed-key mode on the device', () => {
  let client: HemClient;
  let keys: TestKeys;
  let xKid: string;
  let p384Kid: string;
  let xPeer: LocalPeer;
  let devicePub: Uint8Array;

  beforeAll(async () => {
    client = deviceClient();
    keys = new TestKeys(client);
    xKid = await keys.create({ type: 'CURVE25519' });
    p384Kid = await keys.create({ type: 'SECP384R1', mode: 'ECDH' });
    xPeer = await localX25519();
    devicePub = (await client.keys.get(xKid)).pubkey as Uint8Array;
    expect(devicePub).toHaveLength(32);
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('cleanup', 'done');
  }, 120_000);

  // verifies: REQ-OPS-010
  it('the device’s raw X25519 secret equals the one computed locally with Web Crypto; the digest form too', async () => {
    const device = await client.crypto.ecdh({ kid: xKid, peer: { pubkey: xPeer.publicKey } });
    const local = await xPeer.secretWith(devicePub);
    log('X25519', { deviceBytes: device.length, localBytes: local.length, equal: same(device, local) });
    expect(same(device, local)).toBe(true);
    const digest = await client.crypto.ecdh({ kid: xKid, peer: { pubkey: xPeer.publicKey }, alg: 'SHA2-384' });
    const localDigest = new Uint8Array(await crypto.subtle.digest('SHA-384', buf(local)));
    log('X25519 SHA2-384', { deviceBytes: digest.length, equalsLocalDigestOfSecret: same(digest, localDigest) });
    expect(digest).toHaveLength(48);
  }, 60_000);

  // verifies: REQ-OPS-010
  it('records the raw output length for a P-384 key (quirk 9), trying the peer as compressed, uncompressed and stored', async () => {
    const peer = await localP384();
    const attempt = (run: () => Promise<Uint8Array>): Promise<{ ok: boolean; bytes?: number; error?: string }> =>
      run().then(
        (secret) => ({ ok: true, bytes: secret.length }),
        (error: unknown) => ({ ok: false, error: `${(error as Error).name} ${(error as { status?: number }).status ?? ''}` }),
      );
    const compressed = await attempt(() => client.crypto.ecdh({ kid: p384Kid, peer: { pubkey: peer.compressed } }));
    const uncompressed = await attempt(() => client.crypto.ecdh({ kid: p384Kid, peer: { pubkey: peer.uncompressed } }));
    const imported = await client.keys.import({ label: keys.label(), pubkey: peer.compressed, type: 'SECP384R1' }).then(
      (kid) => {
        keys.track(kid);
        return kid;
      },
      (error: unknown) => `${(error as Error).name} ${(error as { status?: number }).status ?? ''}`,
    );
    const stored = /^[0-9a-f]{32}$/.test(imported) ? await attempt(() => client.crypto.ecdh({ kid: p384Kid, peer: { extKid: imported } })) : { ok: false, error: `import: ${imported}` };
    const deviceP384 = await keys.create({ type: 'SECP384R1', mode: 'ECDH' });
    const twoStored = await attempt(() => client.crypto.ecdh({ kid: p384Kid, peer: { extKid: deviceP384 } }));
    const libraryDefault384 = await attempt(async () => {
      const plain = await keys.create({ type: 'SECP384R1' });
      return client.crypto.ecdh({ kid: plain, peer: { pubkey: peer.compressed } });
    });
    const stored256 = await attempt(async () => {
      const other = await keys.create({ type: 'SECP256R1' });
      const mine = await keys.create({ type: 'SECP256R1' });
      return client.crypto.ecdh({ kid: mine, peer: { extKid: other } });
    });
    const explicitMode256 = await attempt(async () => {
      const other = await keys.create({ type: 'SECP256R1', mode: 'ECDH' });
      const mine = await keys.create({ type: 'SECP256R1', mode: 'ECDH' });
      return client.crypto.ecdh({ kid: mine, peer: { extKid: other } });
    });
    const curve448 = await attempt(async () => {
      const other = await keys.create({ type: 'CURVE448' });
      const mine = await keys.create({ type: 'CURVE448' });
      return client.crypto.ecdh({ kid: mine, peer: { extKid: other } });
    });
    const x25519TwoDeviceKeys = await attempt(async () => {
      const other = await keys.create({ type: 'CURVE25519' });
      return client.crypto.ecdh({ kid: xKid, peer: { extKid: other } });
    });
    const types = Object.fromEntries((await client.keys.listAll()).filter((k) => keys.created.includes(k.kid)).map((k) => [k.kid.slice(0, 8), k.type.raw]));
    log('P-384 raw', { keyWithEcdhMode: { compressedPeer: compressed, uncompressedPeer: uncompressed, storedLocalPeer: stored, twoDeviceKeys: twoStored }, keyWithLibraryDefaultMode: libraryDefault384, p256LibraryDefaultMode: stored256, p256ExplicitEcdhMode: explicitMode256, curve448TwoDeviceKeys: curve448, x25519TwoDeviceKeys, listedTypes: types });
    expect(x25519TwoDeviceKeys.ok).toBe(true);
    expect(compressed.ok || stored.ok, 'a P-384 key created with mode ECDH agrees with a P-384 peer').toBe(true);
  }, 180_000);

  // verifies: REQ-OPS-010
  it('a stored peer works too: ECDH with the imported local public key gives the same secret', async () => {
    const imported = await client.keys.import({ label: keys.label(), pubkey: xPeer.publicKey, type: 'CURVE25519' });
    keys.track(imported);
    const viaStored = await client.crypto.ecdh({ kid: xKid, peer: { extKid: imported } });
    expect(same(viaStored, await xPeer.secretWith(devicePub))).toBe(true);
  }, 60_000);

  // verifies: REQ-OPS-015
  it('agreed-key encrypt then decrypt with the same pair and context returns the message', async () => {
    const ctx = new TextEncoder().encode('EHEMTEST ctx');
    const encrypted = await client.crypto.encrypt({ kid: xKid, msg: MSG, alg: 'AES256-GCM', peer: { pubkey: xPeer.publicKey }, ctx });
    const decrypted = await client.crypto.decrypt({ kid: xKid, msg: encrypted.ciphertext, alg: 'AES256-GCM', iv: encrypted.iv, tag: encrypted.tag, peer: { pubkey: xPeer.publicKey }, ctx });
    expect(same(decrypted, MSG)).toBe(true);
    const otherCtx = await client.crypto
      .decrypt({ kid: xKid, msg: encrypted.ciphertext, alg: 'AES256-GCM', iv: encrypted.iv, tag: encrypted.tag, peer: { pubkey: xPeer.publicKey }, ctx: new Uint8Array([1]) })
      .then(() => 'decrypted', (error: unknown) => `${(error as Error).name} ${(error as { status?: number }).status ?? ''}`);
    const wrapped = await client.crypto.wrap({ kid: xKid, msg: new Uint8Array(32).fill(7), peer: { pubkey: xPeer.publicKey } });
    const unwrapped = await client.crypto.unwrap({ kid: xKid, msg: wrapped, peer: { pubkey: xPeer.publicKey } });
    log('agreed-key cipher and wrap', { gcmRoundTrip: true, otherCtx, wrappedBytes: wrapped.length, unwrapRoundTrip: same(unwrapped, new Uint8Array(32).fill(7)) });
    expect(same(unwrapped, new Uint8Array(32).fill(7))).toBe(true);
  }, 60_000);

  // verifies: REQ-OPS-015
  it('the agreed-key HMAC equals HMAC-SHA256 computed locally with the ECDH secret as the key', async () => {
    const device = await client.crypto.hmac({ kid: xKid, msg: MSG, peer: { pubkey: xPeer.publicKey }, alg: 'SHA2-256' });
    const secret = await xPeer.secretWith(devicePub);
    const key = await crypto.subtle.importKey('raw', buf(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const local = new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(MSG)));
    log('agreed-key HMAC', { deviceBytes: device.length, equalsLocal: same(device, local) });
    expect(same(device, local)).toBe(true);
    expect(await client.crypto.hmacVerify({ kid: xKid, msg: MSG, mac: local, peer: { pubkey: xPeer.publicKey }, alg: 'SHA2-256' })).toBe(true);
  }, 60_000);
});
