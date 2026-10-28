// ECDH shared secret, and the ECDH-agreed key mode of HMAC, cipher and wrap (M2).
import { describe, expect, it } from 'vitest';
import {
  type EcdhParams,
  HASH_ALGORITHMS,
  type HemClient,
  HemOperationFailedError,
  HemTlsRequiredError,
  HemValidationError,
  MAX_HKDF_CONTEXT_BYTES,
} from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';

const KID = '00112233445566778899aabbccddeeff';
const PEER_KID = 'fedcba9876543210fedcba9876543210';
const PUBKEY = Uint8Array.from([0x02, 0xaa, 0xbb]);
const bytes = (length: number, fill = 0x41): Uint8Array => new Uint8Array(length).fill(fill);
const b64 = (data: Uint8Array): string => btoa(String.fromCharCode(...data));
const IV = bytes(16, 1);
const TAG = bytes(16, 2);

describe('crypto.ecdh', () => {
  // verifies: REQ-OPS-010, REQ-AUTH-005
  it('posts {kid, ext_kid} with scope keymgmt:use:<kid> of the stored key and returns the secret bytes', async () => {
    const secret = bytes(32, 9);
    const fake = loginDevice().on('POST', '/api/crypto/ecdh', { body: { ecdh: b64(secret) } });
    const result = await loggedInClient(fake).crypto.ecdh({ kid: KID.toUpperCase(), peer: { extKid: PEER_KID.toUpperCase() } });
    expect(result).toEqual(secret);
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
    const [request] = operationRequests(fake);
    expect(request?.method).toBe('POST');
    expect(request?.url.href).toBe('https://my.ence.do/api/crypto/ecdh');
    expect(request?.json()).toEqual({ kid: KID, ext_kid: PEER_KID });
  });

  // verifies: REQ-OPS-010
  it('sends a raw peer as pubkey and alg when given', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/ecdh', { body: { ecdh: 'AQ==' } });
    await loggedInClient(fake).crypto.ecdh({ kid: KID, peer: { pubkey: PUBKEY }, alg: 'SHA2-384' });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, pubkey: 'Aqq7', alg: 'SHA2-384' });
  });

  // verifies: REQ-OPS-010
  it.each(HASH_ALGORITHMS)('accepts digest %s', async (alg) => {
    const fake = loginDevice().on('POST', '/api/crypto/ecdh', { body: { ecdh: 'AQ==' } });
    await loggedInClient(fake).crypto.ecdh({ kid: KID, peer: { extKid: PEER_KID }, alg });
    expect((operationRequests(fake)[0]?.json() as { alg: string }).alg).toBe(alg);
  });

  // verifies: REQ-OPS-010, REQ-API-005
  it.each([
    [{ kid: KID, peer: { extKid: PEER_KID, pubkey: PUBKEY } }, 'peer'],
    [{ kid: KID, peer: {} }, 'peer'],
    [{ kid: KID }, 'peer'],
    [{ kid: KID, peer: { pubkey: new Uint8Array(0) } }, 'peer.pubkey'],
    [{ kid: KID, peer: { extKid: PEER_KID }, alg: 'MD5' }, 'alg'],
    [{ kid: 'k', peer: { extKid: PEER_KID } }, 'kid'],
  ])('refuses %j naming %s without any request', async (params, parameter) => {
    const fake = loginDevice();
    const error = await loggedInClient(fake).crypto.ecdh(params as unknown as EcdhParams).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-010
  it('raises HemOperationFailedError for 406 (missing peer key or derive failure)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/ecdh', { status: 406 });
    await expect(loggedInClient(fake).crypto.ecdh({ kid: KID, peer: { extKid: PEER_KID } })).rejects.toThrow(HemOperationFailedError);
  });

  // verifies: REQ-NET-003
  it('is refused over plain HTTP before any request', async () => {
    const fake = loginDevice();
    await expect(loggedInClient(fake, { url: 'http://192.168.7.1' }).crypto.ecdh({ kid: KID, peer: { extKid: PEER_KID } })).rejects.toThrow(HemTlsRequiredError);
    expect(fake.requests).toHaveLength(0);
  });
});

interface AgreedCase {
  name: string;
  path: string;
  reply: Record<string, unknown> | undefined;
  /** The call in agreed-key mode with the given peer and extras. */
  run: (client: HemClient, extra: Record<string, unknown>) => Promise<unknown>;
  /** Body fields besides the peer and ctx. */
  base: Record<string, unknown>;
  /** Whether the operation derives through HKDF (takes ctx). */
  hkdf: boolean;
}

const CASES: AgreedCase[] = [
  {
    name: 'hmac',
    path: '/api/crypto/hmac/hash',
    reply: { mac: 'AQ==' },
    run: (c, extra) => c.crypto.hmac({ kid: KID, msg: bytes(1), alg: 'SHA2-256', ...extra }),
    base: { kid: KID, msg: 'QQ==', alg: 'SHA2-256' },
    hkdf: false,
  },
  {
    name: 'hmacVerify',
    path: '/api/crypto/hmac/verify',
    reply: undefined,
    run: (c, extra) => c.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(32), alg: 'SHA3-512', ...extra }),
    base: { kid: KID, msg: 'QQ==', mac: b64(bytes(32)), alg: 'SHA3-512' },
    hkdf: false,
  },
  {
    name: 'encrypt',
    path: '/api/crypto/cipher/encrypt',
    reply: { ciphertext: 'AQ==', iv: b64(IV), tag: b64(TAG) },
    run: (c, extra) => c.crypto.encrypt({ kid: KID, msg: bytes(1), alg: 'AES256-GCM', ...extra }),
    base: { kid: KID, msg: 'QQ==', alg: 'AES256-GCM' },
    hkdf: true,
  },
  {
    name: 'decrypt',
    path: '/api/crypto/cipher/decrypt',
    reply: { plaintext: 'AQ==' },
    run: (c, extra) => c.crypto.decrypt({ kid: KID, msg: bytes(1), alg: 'AES256-GCM', iv: IV, tag: TAG, ...extra }),
    base: { kid: KID, msg: 'QQ==', alg: 'AES256-GCM', iv: b64(IV), tag: b64(TAG) },
    hkdf: true,
  },
  {
    name: 'wrap',
    path: '/api/crypto/cipher/wrap',
    reply: { wrapped: 'AQ==' },
    run: (c, extra) => c.crypto.wrap({ kid: KID, msg: bytes(16), ...extra }),
    base: { kid: KID, msg: b64(bytes(16)) },
    hkdf: true,
  },
  {
    name: 'unwrap',
    path: '/api/crypto/cipher/unwrap',
    reply: { unwrapped: 'AQ==' },
    run: (c, extra) => c.crypto.unwrap({ kid: KID, msg: bytes(24), ...extra }),
    base: { kid: KID, msg: b64(bytes(24)) },
    hkdf: true,
  },
];

function deviceFor(c: AgreedCase): FakeFetch {
  return loginDevice().always('POST', c.path, c.reply === undefined ? { status: 200 } : { body: c.reply });
}

describe('agreed-key mode', () => {
  // verifies: REQ-OPS-015
  it.each(CASES)('$name: sends a stored peer as ext_kid and a raw peer as pubkey', async (c) => {
    const fake = deviceFor(c);
    const client = loggedInClient(fake);
    await c.run(client, { peer: { extKid: PEER_KID.toUpperCase() } });
    await c.run(client, { peer: { pubkey: PUBKEY } });
    const [stored, raw] = operationRequests(fake);
    expect(stored?.json()).toEqual({ ...c.base, ext_kid: PEER_KID });
    expect(raw?.json()).toEqual({ ...c.base, pubkey: 'Aqq7' });
  });

  // verifies: REQ-OPS-015, REQ-AUTH-005
  it.each(CASES)('$name: the token scope is keymgmt:use:<kid> of the primary key, not of the peer', async (c) => {
    const fake = deviceFor(c);
    await c.run(loggedInClient(fake), { peer: { extKid: PEER_KID } });
    expect(loginScopes(fake)).toEqual([`keymgmt:use:${KID}`]);
  });

  // verifies: REQ-OPS-015
  it.each(CASES.filter((c) => c.hkdf))('$name: sends ctx (base64, up to 64 bytes) with a peer', async (c) => {
    const fake = deviceFor(c);
    const client = loggedInClient(fake);
    await c.run(client, { peer: { extKid: PEER_KID }, ctx: Uint8Array.from([5, 6]) });
    await c.run(client, { peer: { extKid: PEER_KID }, ctx: bytes(MAX_HKDF_CONTEXT_BYTES) });
    const [short, max] = operationRequests(fake);
    expect(short?.json()).toEqual({ ...c.base, ext_kid: PEER_KID, ctx: 'BQY=' });
    expect((max?.json() as { ctx: string }).ctx).toBe(b64(bytes(MAX_HKDF_CONTEXT_BYTES)));
  });

  // verifies: REQ-OPS-015, REQ-API-005
  it.each(CASES)('$name: both peer forms, a context without a peer, or a context over 64 bytes raise HemValidationError with no request', async (c) => {
    const fake = loginDevice();
    const client = loggedInClient(fake);
    const refused = async (extra: Record<string, unknown>, parameter: string): Promise<void> => {
      const error = await c.run(client, extra).catch((e: unknown) => e);
      expect(error, `${c.name} ${parameter}`).toBeInstanceOf(HemValidationError);
      expect((error as HemValidationError).parameter).toBe(parameter);
    };
    await refused({ peer: { extKid: PEER_KID, pubkey: PUBKEY } }, 'peer');
    await refused({ peer: {} }, 'peer');
    await refused({ peer: { extKid: PEER_KID }, ctx: bytes(MAX_HKDF_CONTEXT_BYTES + 1) }, 'ctx');
    await refused({ peer: { extKid: PEER_KID }, ctx: 'text' }, 'ctx');
    await refused({ ctx: bytes(1) }, 'ctx');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-015
  it('HMAC in the agreed-key mode needs alg, and refuses alg and ctx with a stored key', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake);
    const cases: [() => Promise<unknown>, string][] = [
      [() => client.crypto.hmac({ kid: KID, msg: bytes(1), peer: { extKid: PEER_KID } }), 'alg'],
      [() => client.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(32), peer: { extKid: PEER_KID } }), 'alg'],
      [() => client.crypto.hmac({ kid: KID, msg: bytes(1), peer: { extKid: PEER_KID }, alg: 'SHA2-256', ctx: bytes(1) as never }), 'ctx'],
      [() => client.crypto.hmac({ kid: KID, msg: bytes(1), alg: 'SHA2-256' }), 'alg'],
      [() => client.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(32), alg: 'SHA2-256' }), 'alg'],
      [() => client.crypto.hmac({ kid: KID, msg: bytes(1), peer: { extKid: PEER_KID }, alg: 'SHA1' as never }), 'alg'],
    ];
    for (const [run, parameter] of cases) {
      const error = await run().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HemValidationError);
      expect((error as HemValidationError).parameter).toBe(parameter);
    }
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-OPS-001, REQ-OPS-015
  it('HMAC with a stored key still sends no alg and no peer (M1 behaviour unchanged)', async () => {
    const fake = loginDevice().on('POST', '/api/crypto/hmac/hash', { body: { mac: 'AQ==' } });
    await loggedInClient(fake).crypto.hmac({ kid: KID, msg: bytes(1) });
    expect(operationRequests(fake)[0]?.json()).toEqual({ kid: KID, msg: 'QQ==' });
  });
});
