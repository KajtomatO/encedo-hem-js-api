// Cross-binding conformance: walks every operation description (ALL_OPERATIONS),
// so a new operation without an entry in the sample table fails the coverage check.
import { describe, expect, it } from 'vitest';
import { ALL_OPERATIONS } from '../../src/api/operations.js';
import { type HemClient, HemTlsRequiredError, HemValidationError } from '../../src/index.js';
import { loggedInClient, loginScopes, operationRequests } from '../support/device.js';
import { FakeFetch, type RecordedRequest } from '../support/fake-fetch.js';
import { claimsOf, fakeToken, issueToken, vectorChallenge } from '../support/login.js';
import { loginVector as v } from '../support/vectors.js';

const KID = '0123456789abcdef0123456789abcdef';
const UPPER_KID = KID.toUpperCase();
const NEW_KID = '00112233445566778899aabbccddeeff';
const IV16 = 'AQEBAQEBAQEBAQEBAQEBAQ==';
const CONFIG = {
  iat: 1, uts: 2, devid: '0011223344556677', eid: 'AQ==', eid_sign: 'Ag==', user: 'u', email: 'e', hostname: 'h', dnsd: true, trusted_ts: true,
  trusted_backend: false, allow_keysearch: true, origin: '*', ctx: 0, ip: '192.168.7.1/24', http_option_hsts: false, http_option_dosprot_mode: 0, spk: 'Aw==', nonce: 'BA==',
};
const CONFIG_RESULT = {
  createdAt: 1, updatedAt: 2, devid: '0011223344556677', eid: Uint8Array.from([1]), eidSign: Uint8Array.from([2]), user: 'u', email: 'e', hostname: 'h', dnsd: true,
  trustedTime: true, trustedBackend: false, allowKeysearch: true, origin: '*', ctx: 0, ip: '192.168.7.1/24', hsts: false, dosProtectionMode: 0,
  spk: Uint8Array.from([3]), nonce: Uint8Array.from([4]),
};
const EPK = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const APP_TOKEN = fakeToken({ sub: 'YXBw', exp: v.iat + 900 });
const STATUS = { ctx: 0, uptime: 1, temp: 30, fls_state: 0 };
const ENTRY = { kid: KID, created: 1, type: 'PKEY,AES256', label: 'k', updated: 2 };
const ENVELOPE = { offset: 0, deleted: 0, total: 1, listed: 1, list: [ENTRY] };
const ENTRY_RESULT = { kid: KID, created: 1, label: 'k', updated: 2, type: { raw: 'PKEY,AES256', flags: ['PKEY'], algorithm: 'AES256', unknown: [] } };
const PAGE_RESULT = { offset: 0, total: 1, listed: 1, deleted: 0, keys: [ENTRY_RESULT] };
const ALLOWED_HEADERS = ['content-type', 'authorization', 'content-disposition'];

/** A fake device answering every M1 operation and every login. */
function device(): FakeFetch {
  return new FakeFetch()
    .always('GET', '/api/auth/token', { body: vectorChallenge })
    .always('POST', '/api/auth/token', issueToken())
    .always('POST', '/api/auth/ext/request', { body: { authreq: 'a.b.c', epk: EPK } })
    .always('POST', '/api/auth/ext/token', { body: { token: APP_TOKEN } })
    .always('GET', '/api/system/status', { body: STATUS })
    .always('GET', '/api/system/version', { body: { hwv: 'h', fwv: 'f', fwk: 'AQI=', fws: 'AwQ=' } })
    .always('GET', '/api/system/checkin', { body: { check: 'chk' } })
    .always('POST', '/api/system/checkin', { body: { status: 'OK' } })
    .always('GET', '/api/system/config', { body: CONFIG })
    .always('POST', '/api/keymgmt/create', { body: { kid: KID } })
    .always('GET', `/api/keymgmt/get/${KID}`, { body: { updated: 5, pubkey: 'AQID' } })
    .always('GET', /^\/api\/keymgmt\/list/, { body: ENVELOPE })
    .always('POST', '/api/keymgmt/search', { body: ENVELOPE })
    .always('DELETE', `/api/keymgmt/delete/${KID}`, { status: 200 })
    .always('POST', '/api/keymgmt/update', { status: 200 })
    .always('POST', '/api/keymgmt/import', { body: { kid: NEW_KID } })
    .always('POST', '/api/keymgmt/derive', { body: { kid: NEW_KID } })
    .always('POST', '/api/crypto/hmac/hash', { body: { mac: 'BQY=' } })
    .always('POST', '/api/crypto/cipher/wrap', { body: { wrapped: 'BwgJ' } })
    .always('POST', '/api/crypto/cipher/unwrap', { body: { unwrapped: 'CgsM' } })
    .always('POST', '/api/crypto/hmac/verify', { status: 200 })
    .always('POST', '/api/crypto/exdsa/sign', { body: { sign: 'DQ4=' } })
    .always('POST', '/api/crypto/exdsa/verify', { status: 200 })
    .always('POST', '/api/crypto/cipher/encrypt', { body: { ciphertext: 'Dw==', iv: IV16, tag: IV16 } })
    .always('POST', '/api/crypto/cipher/decrypt', { body: { plaintext: 'EA==' } })
    .always('POST', '/api/crypto/ecdh', { body: { ecdh: 'ERI=' } })
    .always('POST', '/api/crypto/pqc/mlkem/encaps', { body: { alg: 'MLKEM768', ss: 'Ew==', ct: 'FA==' } })
    .always('POST', '/api/crypto/pqc/mlkem/decaps', { body: { alg: 'garbage', ss: 'Ew==' } })
    .always('POST', '/api/crypto/pqc/mldsa/sign', { body: { alg: 'MLDSA65', sign: 'FQ==' } })
    .always('POST', '/api/crypto/pqc/mldsa/verify', { status: 200 })
    .always('GET', '/api/logger/key', { body: { key: 'AQ==', nonce: 'Ag==', nonce_signed: 'Aw==' } })
    .always('GET', /^\/api\/logger\/list/, { body: { total: 2, id: ['0000a1b2'] } })
    .always('GET', '/api/logger/0000a1b2', { body: new TextEncoder().encode('a|b\n'), headers: { 'content-type': 'text/plain' } });
}

interface Sample {
  /** Makes the call; for the two login steps, an authenticated call that needs a login. */
  run(client: HemClient): Promise<unknown>;
  /** Path the request goes to. */
  path: string;
  body: unknown;
  result?: unknown;
}

// One entry per operation description, keyed `<name> <path template>`.
const samples: Record<string, Sample> = {
  'auth.challenge /api/auth/token': { run: (c) => c.keys.list(), path: '/api/auth/token', body: undefined },
  'auth.login /api/auth/token': { run: (c) => c.keys.list(), path: '/api/auth/token', body: 'proof' },
  'auth.requestApproval /api/auth/ext/request': {
    run: (c) => c.auth.requestApproval({ epk: EPK, scope: 'keymgmt:list', note: 'n' }),
    path: '/api/auth/ext/request',
    body: { epk: EPK, scope: 'keymgmt:list', note: 'n' },
    result: { authreq: 'a.b.c', epk: EPK },
  },
  'auth.redeemApproval /api/auth/ext/token': {
    run: (c) => c.auth.redeemApproval({ authreply: 'reply', scope: 'keymgmt:list' }),
    path: '/api/auth/ext/token',
    body: { authreply: 'reply' },
    result: { scope: 'keymgmt:list', role: { kind: 'app', id: 'YXBw' }, expiresAt: v.iat + 900 },
  },
  'system.status /api/system/status': {
    run: (c) => c.system.status(),
    path: '/api/system/status',
    body: undefined,
    result: { initialised: true, clockSet: false, ctx: 0, uptime: 1, temp: 30, flsState: 0, trustedTime: true, fwUpgrade: false },
  },
  'system.version /api/system/version': {
    run: (c) => c.system.version(),
    path: '/api/system/version',
    body: undefined,
    result: { hwv: 'h', fwv: 'f', fwk: Uint8Array.from([1, 2]), fws: Uint8Array.from([3, 4]) },
  },
  'system.getCheckin /api/system/checkin': { run: (c) => c.system.getCheckin(), path: '/api/system/checkin', body: undefined, result: 'chk' },
  'system.postCheckin /api/system/checkin': {
    run: (c) => c.system.postCheckin('reply'),
    path: '/api/system/checkin',
    body: { checked: 'reply' },
    result: { status: 'OK' },
  },
  'system.config /api/system/config': { run: (c) => c.system.config(), path: '/api/system/config', body: undefined, result: CONFIG_RESULT },
  'keys.create /api/keymgmt/create': {
    run: (c) => c.keys.create({ label: 'k', type: 'AES256' }),
    path: '/api/keymgmt/create',
    body: { label: 'k', type: 'AES256' },
    result: KID,
  },
  'keys.get /api/keymgmt/get/{kid}': {
    run: (c) => c.keys.get(UPPER_KID),
    path: `/api/keymgmt/get/${KID}`,
    body: undefined,
    result: { updated: 5, pubkey: Uint8Array.from([1, 2, 3]) },
  },
  'keys.list /api/keymgmt/list': { run: (c) => c.keys.list(), path: '/api/keymgmt/list', body: undefined, result: PAGE_RESULT },
  'keys.list /api/keymgmt/list/{offset}': { run: (c) => c.keys.list({ offset: 3 }), path: '/api/keymgmt/list/3', body: undefined, result: PAGE_RESULT },
  'keys.list /api/keymgmt/list/{offset}/{count}': {
    run: (c) => c.keys.list({ offset: 3, count: 5 }),
    path: '/api/keymgmt/list/3/5',
    body: undefined,
    result: PAGE_RESULT,
  },
  'keys.search /api/keymgmt/search': {
    run: (c) => c.keys.search({ descr: Uint8Array.from([1, 2, 3]), match: 'prefix' }),
    path: '/api/keymgmt/search',
    body: { descr: '^AQID' },
    result: PAGE_RESULT,
  },
  'keys.delete /api/keymgmt/delete/{kid}': { run: (c) => c.keys.delete(UPPER_KID), path: `/api/keymgmt/delete/${KID}`, body: undefined, result: undefined },
  'keys.update /api/keymgmt/update': {
    run: (c) => c.keys.update({ kid: UPPER_KID, label: 'k', descr: Uint8Array.from([1]) }),
    path: '/api/keymgmt/update',
    body: { kid: KID, label: 'k', descr: 'AQ==' },
    result: undefined,
  },
  'keys.import /api/keymgmt/import': {
    run: (c) => c.keys.import({ label: 'k', pubkey: Uint8Array.from([2, 3]), type: 'ED25519' }),
    path: '/api/keymgmt/import',
    body: { label: 'k', pubkey: 'AgM=', type: 'ED25519' },
    result: NEW_KID,
  },
  'keys.derive /api/keymgmt/derive': {
    run: (c) => c.keys.derive({ kid: UPPER_KID, label: 'k', type: 'AES256', peer: { pubkey: Uint8Array.from([2, 3]) } }),
    path: '/api/keymgmt/derive',
    body: { kid: KID, label: 'k', type: 'AES256', pubkey: 'AgM=' },
    result: NEW_KID,
  },
  'crypto.hmac /api/crypto/hmac/hash': {
    run: (c) => c.crypto.hmac({ kid: UPPER_KID, msg: Uint8Array.from([1]) }),
    path: '/api/crypto/hmac/hash',
    body: { kid: KID, msg: 'AQ==' },
    result: Uint8Array.from([5, 6]),
  },
  'crypto.wrap /api/crypto/cipher/wrap': {
    run: (c) => c.crypto.wrap({ kid: UPPER_KID, msg: new Uint8Array(16) }),
    path: '/api/crypto/cipher/wrap',
    body: { kid: KID, msg: 'AAAAAAAAAAAAAAAAAAAAAA==' },
    result: Uint8Array.from([7, 8, 9]),
  },
  'crypto.unwrap /api/crypto/cipher/unwrap': {
    run: (c) => c.crypto.unwrap({ kid: UPPER_KID, msg: new Uint8Array(24) }),
    path: '/api/crypto/cipher/unwrap',
    body: { kid: KID, msg: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
    result: Uint8Array.from([10, 11, 12]),
  },
  'crypto.hmacVerify /api/crypto/hmac/verify': {
    run: (c) => c.crypto.hmacVerify({ kid: UPPER_KID, msg: Uint8Array.from([1]), mac: Uint8Array.from([5, 6]) }),
    path: '/api/crypto/hmac/verify',
    body: { kid: KID, msg: 'AQ==', mac: 'BQY=' },
    result: true,
  },
  'crypto.sign /api/crypto/exdsa/sign': {
    run: (c) => c.crypto.sign({ kid: UPPER_KID, msg: Uint8Array.from([1]), alg: 'Ed25519' }),
    path: '/api/crypto/exdsa/sign',
    body: { kid: KID, msg: 'AQ==', alg: 'Ed25519' },
    result: Uint8Array.from([13, 14]),
  },
  'crypto.encrypt /api/crypto/cipher/encrypt': {
    run: (c) => c.crypto.encrypt({ kid: UPPER_KID, msg: Uint8Array.from([1]), alg: 'AES256-GCM' }),
    path: '/api/crypto/cipher/encrypt',
    body: { kid: KID, msg: 'AQ==', alg: 'AES256-GCM' },
    result: { ciphertext: Uint8Array.from([15]), iv: new Uint8Array(16).fill(1), tag: new Uint8Array(16).fill(1) },
  },
  'crypto.decrypt /api/crypto/cipher/decrypt': {
    run: (c) => c.crypto.decrypt({ kid: UPPER_KID, msg: Uint8Array.from([15]), alg: 'AES256-GCM', iv: new Uint8Array(16).fill(1), tag: new Uint8Array(16).fill(1) }),
    path: '/api/crypto/cipher/decrypt',
    body: { kid: KID, msg: 'Dw==', alg: 'AES256-GCM', iv: IV16, tag: IV16 },
    result: Uint8Array.from([16]),
  },
  'crypto.ecdh /api/crypto/ecdh': {
    run: (c) => c.crypto.ecdh({ kid: UPPER_KID, peer: { extKid: NEW_KID.toUpperCase() } }),
    path: '/api/crypto/ecdh',
    body: { kid: KID, ext_kid: NEW_KID },
    result: Uint8Array.from([17, 18]),
  },
  'crypto.mlkemEncaps /api/crypto/pqc/mlkem/encaps': {
    run: (c) => c.crypto.mlkemEncaps({ kid: UPPER_KID }),
    path: '/api/crypto/pqc/mlkem/encaps',
    body: { kid: KID },
    result: { alg: 'MLKEM768', sharedSecret: Uint8Array.from([19]), ciphertext: Uint8Array.from([20]) },
  },
  'crypto.mlkemDecaps /api/crypto/pqc/mlkem/decaps': {
    run: (c) => c.crypto.mlkemDecaps({ kid: UPPER_KID, ct: new Uint8Array(768) }),
    path: '/api/crypto/pqc/mlkem/decaps',
    body: { kid: KID, ct: btoa(String.fromCharCode(...new Uint8Array(768))) },
    result: Uint8Array.from([19]),
  },
  'crypto.mldsaSign /api/crypto/pqc/mldsa/sign': {
    run: (c) => c.crypto.mldsaSign({ kid: UPPER_KID, msg: Uint8Array.from([1]) }),
    path: '/api/crypto/pqc/mldsa/sign',
    body: { kid: KID, msg: 'AQ==' },
    result: { alg: 'MLDSA65', signature: Uint8Array.from([21]) },
  },
  'crypto.mldsaVerify /api/crypto/pqc/mldsa/verify': {
    run: (c) => c.crypto.mldsaVerify({ kid: UPPER_KID, msg: Uint8Array.from([1]), sign: Uint8Array.from([21]) }),
    path: '/api/crypto/pqc/mldsa/verify',
    body: { kid: KID, msg: 'AQ==', sign: 'FQ==' },
    result: true,
  },
  'logger.key /api/logger/key': {
    run: (c) => c.logger.key(),
    path: '/api/logger/key',
    body: undefined,
    result: { key: Uint8Array.from([1]), nonce: Uint8Array.from([2]), nonceSigned: Uint8Array.from([3]) },
  },
  'logger.list /api/logger/list': { run: (c) => c.logger.list(), path: '/api/logger/list', body: undefined, result: { total: 2, ids: ['0000a1b2'] } },
  'logger.list /api/logger/list/{offset}': { run: (c) => c.logger.list({ offset: 1 }), path: '/api/logger/list/1', body: undefined, result: { total: 2, ids: ['0000a1b2'] } },
  'logger.download /api/logger/{file}': {
    run: async (c) => {
      const file = await c.logger.download('0000A1B2');
      return { id: file.id, bytes: file.bytes, contentType: file.contentType, text: file.text() };
    },
    path: '/api/logger/0000a1b2',
    body: undefined,
    result: { id: '0000a1b2', bytes: new TextEncoder().encode('a|b\n'), contentType: 'text/plain', text: 'a|b\n' },
  },
  'crypto.verify /api/crypto/exdsa/verify': {
    run: (c) => c.crypto.verify({ kid: UPPER_KID, msg: Uint8Array.from([1]), sign: Uint8Array.from([13, 14]), alg: 'Ed25519' }),
    path: '/api/crypto/exdsa/verify',
    body: { kid: KID, msg: 'AQ==', alg: 'Ed25519', sign: 'DQ4=' },
    result: true,
  },
};

// Token scope per operation, as listed in ARCHITECTURE.md §6 ("Protocol bindings" table).
const ARCHITECTURE_SCOPES: Record<string, string | null> = {
  'auth.challenge': null,
  'auth.login': null,
  'auth.requestApproval': null,
  'auth.redeemApproval': null,
  'system.status': null,
  'system.version': null,
  'system.getCheckin': null,
  'system.postCheckin': null,
  'system.config': 'system:config',
  'keys.create': 'keymgmt:gen',
  'keys.get': `keymgmt:use:${KID}`,
  'keys.search': 'keymgmt:search',
  'keys.list': 'keymgmt:list',
  'keys.delete': 'keymgmt:del',
  'keys.update': 'keymgmt:upd',
  'keys.import': 'keymgmt:imp',
  'keys.derive': 'keymgmt:gen',
  'crypto.hmac': `keymgmt:use:${KID}`,
  'crypto.wrap': `keymgmt:use:${KID}`,
  'crypto.unwrap': `keymgmt:use:${KID}`,
  'crypto.hmacVerify': `keymgmt:use:${KID}`,
  'crypto.sign': `keymgmt:use:${KID}`,
  'crypto.verify': `keymgmt:use:${KID}`,
  'crypto.encrypt': `keymgmt:use:${KID}`,
  'crypto.decrypt': `keymgmt:use:${KID}`,
  'crypto.ecdh': `keymgmt:use:${KID}`,
  'crypto.mlkemEncaps': `keymgmt:use:${KID}`,
  'crypto.mlkemDecaps': `keymgmt:use:${KID}`,
  'crypto.mldsaSign': `keymgmt:use:${KID}`,
  'crypto.mldsaVerify': `keymgmt:use:${KID}`,
  'logger.key': 'logger:get',
  'logger.list': 'logger:get',
  'logger.download': 'logger:get',
};

const operations = ALL_OPERATIONS.map((spec) => ({ spec, key: `${spec.name} ${spec.path}` }));
const isLoginStep = (name: string): boolean => name === 'auth.challenge' || name === 'auth.login';

/** The request of the operation under test. */
function requestOf(fake: FakeFetch, method: string, path: string, name: string): RecordedRequest {
  const matching = fake.requests.filter((r) => r.method === method && r.path === path);
  expect(matching.length, `${name}: a ${method} ${path} request`).toBeGreaterThan(0);
  return matching.at(-1) as RecordedRequest;
}

describe('every operation', () => {
  // verifies: REQ-TEST-001
  it('has an entry in the conformance table', () => {
    expect(operations.map((o) => o.key).filter((key) => !(key in samples))).toEqual([]);
    expect(Object.keys(samples).filter((key) => !operations.some((o) => o.key === key))).toEqual([]);
  });

  // verifies: REQ-TEST-001, REQ-NET-009
  it.each(operations)('$key: method, path, headers, body and response mapping', async ({ spec, key }) => {
    const sample = samples[key] as Sample;
    const fake = device();
    const result = await sample.run(loggedInClient(fake));
    const request = requestOf(fake, spec.method, sample.path, spec.name);

    expect(request.url.href).toBe(`https://my.ence.do${sample.path}`);
    const names = Object.keys(request.headers).sort();
    for (const name of names) expect(ALLOWED_HEADERS, `${key}: header ${name}`).toContain(name);
    expect(names.includes('content-type'), `${key}: Content-Type only with a body`).toBe(request.body !== undefined);
    expect(names.includes('authorization'), `${key}: Authorization only with a scope`).toBe(spec.scope !== null);
    if (sample.body === 'proof') expect(Object.keys(request.json() as object)).toEqual(['auth']);
    else expect(request.json()).toEqual(sample.body);
    if (!isLoginStep(spec.name)) expect(result).toEqual(sample.result);
  });
});

describe('scopes', () => {
  // verifies: REQ-AUTH-005
  it.each(operations.filter((o) => o.spec.scope !== null))('$key requests the scope listed in ARCHITECTURE.md §6', async ({ spec, key }) => {
    const fake = device();
    await (samples[key] as Sample).run(loggedInClient(fake));
    expect(loginScopes(fake)).toEqual([ARCHITECTURE_SCOPES[spec.name]]);
    const request = requestOf(fake, spec.method, (samples[key] as Sample).path, spec.name);
    expect(claimsOf((request.headers['authorization'] as string).replace('Bearer ', ''))['scope']).toBe(ARCHITECTURE_SCOPES[spec.name]);
  });

  // verifies: REQ-AUTH-005
  it('declares no scope for the operations ARCHITECTURE.md §6 lists as needing none', () => {
    for (const { spec } of operations) {
      const expected = ARCHITECTURE_SCOPES[spec.name];
      expect(spec.scope === null, spec.name).toBe(expected === null);
    }
  });
});

describe('public operations with tokens cached', () => {
  // verifies: REQ-AUTH-012
  it.each(operations.filter((o) => o.spec.scope === null))('$key carries no Authorization header', async ({ spec, key }) => {
    const fake = device();
    const client = loggedInClient(fake);
    await client.keys.list();
    await client.crypto.hmac({ kid: KID, msg: Uint8Array.from([1]) });
    const before = fake.requests.length;
    // For the login steps, a call needing a new scope makes the client log in again.
    await (isLoginStep(spec.name) ? client.keys.search({ descr: Uint8Array.from([1]) }) : (samples[key] as Sample).run(client));
    const requests = fake.requests.slice(before).filter((r) => r.method === spec.method && r.path === (samples[key] as Sample).path);
    expect(requests.length, key).toBeGreaterThan(0);
    for (const request of requests) expect(request.headers['authorization'], key).toBeUndefined();
  });
});

describe('plain HTTP', () => {
  // verifies: REQ-NET-003
  it('marks every key-management and crypto operation TLS-only, and no other', () => {
    for (const { spec } of operations) expect(spec.tlsOnly, spec.name).toBe(spec.group === 'keymgmt' || spec.group === 'crypto');
  });

  // verifies: REQ-NET-003
  it.each(operations.filter((o) => !isLoginStep(o.spec.name)))('$key on an http: client', async ({ spec, key }) => {
    const fake = device();
    const client = loggedInClient(fake, { url: 'http://192.168.7.1' });
    const outcome = await (samples[key] as Sample).run(client).then(
      () => 'sent',
      (error: unknown) => error,
    );
    if (spec.tlsOnly) {
      expect(outcome, key).toBeInstanceOf(HemTlsRequiredError);
      expect(fake.requests, key).toHaveLength(0);
    } else {
      expect(outcome, key).toBe('sent');
      expect(fake.requests.every((r) => r.url.protocol === 'http:')).toBe(true);
    }
  });
});

interface Limit {
  name: string;
  /** The parameter named by the validation error. */
  parameter: string;
  /** A call with the boundary value: it is sent. */
  atLimit: (client: HemClient) => Promise<unknown>;
  /** A call with the first value past the boundary: refused before anything is sent. */
  pastLimit: (client: HemClient) => Promise<unknown>;
}

const bytes = (n: number): Uint8Array => new Uint8Array(n);
const chars = (n: number): string => 'x'.repeat(n);

// Every documented hard limit (ARCHITECTURE.md §2 and the reference), each with
// its boundary value and the first value past it. The 7300-byte body limit is
// reached through ML-DSA verify (M2) and is also covered in
// tests/unit/binding-core.test.ts with a synthetic operation.
const LIMITS: Limit[] = [
  { name: 'kid: 32 hex characters, not 33', parameter: 'kid', atLimit: (c) => c.keys.get(KID), pastLimit: (c) => c.keys.get(`${KID}0`) },
  { name: 'kid: 32 hex characters, not 31', parameter: 'kid', atLimit: (c) => c.keys.get(UPPER_KID), pastLimit: (c) => c.keys.get(KID.slice(1)) },
  { name: 'kid: hex only', parameter: 'kid', atLimit: (c) => c.crypto.hmac({ kid: KID, msg: bytes(1) }), pastLimit: (c) => c.crypto.hmac({ kid: `g${KID.slice(1)}`, msg: bytes(1) }) },
  { name: 'delete kid: 32 hex characters, not 33', parameter: 'kid', atLimit: (c) => c.keys.delete(KID), pastLimit: (c) => c.keys.delete(`${KID}0`) },
  { name: 'label: 1 character, not 0', parameter: 'label', atLimit: (c) => c.keys.create({ label: 'k', type: 'AES256' }), pastLimit: (c) => c.keys.create({ label: '', type: 'AES256' }) },
  { name: 'label: 32 characters, not 33', parameter: 'label', atLimit: (c) => c.keys.create({ label: chars(32), type: 'AES256' }), pastLimit: (c) => c.keys.create({ label: chars(33), type: 'AES256' }) },
  { name: 'label: printable ASCII only', parameter: 'label', atLimit: (c) => c.keys.create({ label: ' ~', type: 'AES256' }), pastLimit: (c) => c.keys.create({ label: 'k\u0007', type: 'AES256' }) },
  { name: 'descr on create: 64 bytes, not 65', parameter: 'descr', atLimit: (c) => c.keys.create({ label: 'k', type: 'AES256', descr: bytes(64) }), pastLimit: (c) => c.keys.create({ label: 'k', type: 'AES256', descr: bytes(65) }) },
  { name: 'descr on update: 64 bytes, not 65', parameter: 'descr', atLimit: (c) => c.keys.update({ kid: KID, label: 'k', descr: bytes(64) }), pastLimit: (c) => c.keys.update({ kid: KID, label: 'k', descr: bytes(65) }) },
  { name: 'label on update: 32 characters, not 33', parameter: 'label', atLimit: (c) => c.keys.update({ kid: KID, label: chars(32), descr: bytes(0) }), pastLimit: (c) => c.keys.update({ kid: KID, label: chars(33), descr: bytes(0) }) },
  { name: 'import pubkey: 1 byte, not 0', parameter: 'pubkey', atLimit: (c) => c.keys.import({ label: 'k', pubkey: bytes(1), type: 'ED25519' }), pastLimit: (c) => c.keys.import({ label: 'k', pubkey: bytes(0), type: 'ED25519' }) },
  { name: 'import descr: 64 bytes, not 65', parameter: 'descr', atLimit: (c) => c.keys.import({ label: 'k', pubkey: bytes(1), type: 'ED25519', descr: bytes(64) }), pastLimit: (c) => c.keys.import({ label: 'k', pubkey: bytes(1), type: 'ED25519', descr: bytes(65) }) },
  { name: 'derive peer: one form, not both', parameter: 'peer', atLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: KID } }), pastLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: KID, pubkey: bytes(1) } as never }) },
  { name: 'derive peer pubkey: 1 byte, not 0', parameter: 'peer.pubkey', atLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { pubkey: bytes(1) } }), pastLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { pubkey: bytes(0) } }) },
  { name: 'derive peer extKid: 32 hex characters, not 33', parameter: 'peer.extKid', atLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: UPPER_KID } }), pastLimit: (c) => c.keys.derive({ kid: KID, label: 'k', type: 'AES256', peer: { extKid: `${KID}0` } }) },
  { name: 'descr on search: 64 bytes, not 65', parameter: 'descr', atLimit: (c) => c.keys.search({ descr: bytes(64) }), pastLimit: (c) => c.keys.search({ descr: bytes(65) }) },
  { name: 'search limit: 1, not 0', parameter: 'limit', atLimit: (c) => c.keys.search({ descr: bytes(1), limit: 1 }), pastLimit: (c) => c.keys.search({ descr: bytes(1), limit: 0 }) },
  { name: 'search limit: 15, not 16', parameter: 'limit', atLimit: (c) => c.keys.search({ descr: bytes(1), limit: 15 }), pastLimit: (c) => c.keys.search({ descr: bytes(1), limit: 16 }) },
  { name: 'search offset: 0, not -1', parameter: 'offset', atLimit: (c) => c.keys.search({ descr: bytes(1), offset: 0 }), pastLimit: (c) => c.keys.search({ descr: bytes(1), offset: -1 }) },
  { name: 'list count: 1, not 0', parameter: 'count', atLimit: (c) => c.keys.list({ offset: 0, count: 1 }), pastLimit: (c) => c.keys.list({ offset: 0, count: 0 }) },
  { name: 'list count: 15, not 16', parameter: 'count', atLimit: (c) => c.keys.list({ offset: 0, count: 15 }), pastLimit: (c) => c.keys.list({ offset: 0, count: 16 }) },
  { name: 'list offset: 0, not -1', parameter: 'offset', atLimit: (c) => c.keys.list({ offset: 0 }), pastLimit: (c) => c.keys.list({ offset: -1 }) },
  { name: 'hmac msg: 1 byte, not 0', parameter: 'msg', atLimit: (c) => c.crypto.hmac({ kid: KID, msg: bytes(1) }), pastLimit: (c) => c.crypto.hmac({ kid: KID, msg: bytes(0) }) },
  { name: 'hmac msg: 2048 bytes, not 2049', parameter: 'msg', atLimit: (c) => c.crypto.hmac({ kid: KID, msg: bytes(2048) }), pastLimit: (c) => c.crypto.hmac({ kid: KID, msg: bytes(2049) }) },
  { name: 'wrap msg: 16 bytes, not 8', parameter: 'msg', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(8) }) },
  { name: 'wrap msg: 2048 bytes, not 2056', parameter: 'msg', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(2048) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(2056) }) },
  { name: 'wrap msg: a multiple of 8', parameter: 'msg', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(24) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(20) }) },
  { name: 'wrap iv: 8 bytes, not 7', parameter: 'iv', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), iv: bytes(8) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), iv: bytes(7) }) },
  { name: 'wrap iv: 8 bytes, not 9', parameter: 'iv', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), iv: bytes(8) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), iv: bytes(9) }) },
  { name: 'unwrap msg: a non-empty multiple of 8', parameter: 'msg', atLimit: (c) => c.crypto.unwrap({ kid: KID, msg: bytes(16) }), pastLimit: (c) => c.crypto.unwrap({ kid: KID, msg: bytes(12) }) },
  { name: 'unwrap msg: not empty', parameter: 'msg', atLimit: (c) => c.crypto.unwrap({ kid: KID, msg: bytes(8) }), pastLimit: (c) => c.crypto.unwrap({ kid: KID, msg: bytes(0) }) },
  { name: 'hmacVerify mac: 64 bytes, not 65', parameter: 'mac', atLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(64) }), pastLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(65) }) },
  { name: 'hmacVerify mac: 1 byte, not 0', parameter: 'mac', atLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(1) }), pastLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(1), mac: bytes(0) }) },
  { name: 'hmacVerify msg: 2048 bytes, not 2049', parameter: 'msg', atLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(2048), mac: bytes(1) }), pastLimit: (c) => c.crypto.hmacVerify({ kid: KID, msg: bytes(2049), mac: bytes(1) }) },
  { name: 'sign ctx: 255 bytes, not 256', parameter: 'ctx', atLimit: (c) => c.crypto.sign({ kid: KID, msg: bytes(1), alg: 'Ed448', ctx: bytes(255) }), pastLimit: (c) => c.crypto.sign({ kid: KID, msg: bytes(1), alg: 'Ed448', ctx: bytes(256) }) },
  { name: 'sign msg: 2048 bytes, not 2049', parameter: 'msg', atLimit: (c) => c.crypto.sign({ kid: KID, msg: bytes(2048), alg: 'Ed25519' }), pastLimit: (c) => c.crypto.sign({ kid: KID, msg: bytes(2049), alg: 'Ed25519' }) },
  { name: 'verify sign: 1 byte, not 0', parameter: 'sign', atLimit: (c) => c.crypto.verify({ kid: KID, msg: bytes(1), sign: bytes(1), alg: 'Ed25519' }), pastLimit: (c) => c.crypto.verify({ kid: KID, msg: bytes(1), sign: bytes(0), alg: 'Ed25519' }) },
  { name: 'verify ctx: 255 bytes, not 256', parameter: 'ctx', atLimit: (c) => c.crypto.verify({ kid: KID, msg: bytes(1), sign: bytes(1), alg: 'Ed25519ctx', ctx: bytes(255) }), pastLimit: (c) => c.crypto.verify({ kid: KID, msg: bytes(1), sign: bytes(1), alg: 'Ed25519ctx', ctx: bytes(256) }) },
  { name: 'encrypt msg: 2048 bytes, not 2049', parameter: 'msg', atLimit: (c) => c.crypto.encrypt({ kid: KID, msg: bytes(2048), alg: 'AES256-CBC' }), pastLimit: (c) => c.crypto.encrypt({ kid: KID, msg: bytes(2049), alg: 'AES256-CBC' }) },
  { name: 'encrypt ECB msg: a multiple of 16', parameter: 'msg', atLimit: (c) => c.crypto.encrypt({ kid: KID, msg: bytes(32), alg: 'AES256-ECB' }), pastLimit: (c) => c.crypto.encrypt({ kid: KID, msg: bytes(24), alg: 'AES256-ECB' }) },
  { name: 'decrypt iv: 16 bytes, not 15', parameter: 'iv', atLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-CBC', iv: bytes(16) }), pastLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-CBC', iv: bytes(15) }) },
  { name: 'decrypt iv: 16 bytes, not 17', parameter: 'iv', atLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-CBC', iv: bytes(16) }), pastLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-CBC', iv: bytes(17) }) },
  { name: 'decrypt tag: 16 bytes, not 15', parameter: 'tag', atLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-GCM', iv: bytes(16), tag: bytes(16) }), pastLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(16), alg: 'AES256-GCM', iv: bytes(16), tag: bytes(15) }) },
  { name: 'decrypt msg: 1 byte, not 0', parameter: 'msg', atLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(1), alg: 'AES256-GCM', iv: bytes(16), tag: bytes(16) }), pastLimit: (c) => c.crypto.decrypt({ kid: KID, msg: bytes(0), alg: 'AES256-GCM', iv: bytes(16), tag: bytes(16) }) },
  { name: 'agreed-key ctx: 64 bytes, not 65', parameter: 'ctx', atLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), peer: { extKid: NEW_KID }, ctx: bytes(64) }), pastLimit: (c) => c.crypto.wrap({ kid: KID, msg: bytes(16), peer: { extKid: NEW_KID }, ctx: bytes(65) }) },
  { name: 'ecdh peer: one form, not both', parameter: 'peer', atLimit: (c) => c.crypto.ecdh({ kid: KID, peer: { pubkey: bytes(1) } }), pastLimit: (c) => c.crypto.ecdh({ kid: KID, peer: { extKid: NEW_KID, pubkey: bytes(1) } as never }) },
  { name: 'decaps ct: 768 bytes, not 767', parameter: 'ct', atLimit: (c) => c.crypto.mlkemDecaps({ kid: KID, ct: bytes(768) }), pastLimit: (c) => c.crypto.mlkemDecaps({ kid: KID, ct: bytes(767) }) },
  { name: 'decaps ct: 1568 bytes, not 1569', parameter: 'ct', atLimit: (c) => c.crypto.mlkemDecaps({ kid: KID, ct: bytes(1568) }), pastLimit: (c) => c.crypto.mlkemDecaps({ kid: KID, ct: bytes(1569) }) },
  { name: 'mldsaSign ctx: 255 bytes, not 256', parameter: 'ctx', atLimit: (c) => c.crypto.mldsaSign({ kid: KID, msg: bytes(1), ctx: bytes(255) }), pastLimit: (c) => c.crypto.mldsaSign({ kid: KID, msg: bytes(1), ctx: bytes(256) }) },
  { name: 'mldsaVerify sign: 4627 bytes, not 4628', parameter: 'sign', atLimit: (c) => c.crypto.mldsaVerify({ kid: KID, msg: bytes(1), sign: bytes(4627) }), pastLimit: (c) => c.crypto.mldsaVerify({ kid: KID, msg: bytes(1), sign: bytes(4628) }) },
  { name: 'mldsaVerify body: 7300 bytes, not more', parameter: 'body', atLimit: (c) => c.crypto.mldsaVerify({ kid: KID, msg: bytes(798), sign: bytes(4627) }), pastLimit: (c) => c.crypto.mldsaVerify({ kid: KID, msg: bytes(2048), sign: bytes(4627) }) },
  { name: 'log list offset: 0, not -1', parameter: 'offset', atLimit: (c) => c.logger.list({ offset: 0 }), pastLimit: (c) => c.logger.list({ offset: -1 }) },
  { name: 'log file id: 8 hex characters, not 9', parameter: 'file', atLimit: (c) => c.logger.download('0000a1b2'), pastLimit: (c) => c.logger.download('0000a1b20') },
  { name: 'log file id: 8 hex characters, not 7', parameter: 'file', atLimit: (c) => c.logger.download('0000A1B2'), pastLimit: (c) => c.logger.download('0000a1b') },
  { name: 'approval scope: 1023 characters, not 1024', parameter: 'scope', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: chars(1023) }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: chars(1024) }) },
  { name: 'approval scope: 1 character, not 0', parameter: 'scope', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k' }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: '' }) },
  { name: 'approval ctx: 64 characters, not 65', parameter: 'ctx', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', ctx: chars(64) }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', ctx: chars(65) }) },
  { name: 'approval ctx: 1 character, not 0', parameter: 'ctx', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', ctx: 'c' }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', ctx: '' }) },
  { name: 'approval note: 128 characters, not 129', parameter: 'note', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', note: chars(128) }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', note: chars(129) }) },
  { name: 'approval note: 1 character, not 0', parameter: 'note', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', note: 'n' }), pastLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k', note: '' }) },
  { name: 'approval epk: base64 of 32 bytes', parameter: 'epk', atLimit: (c) => c.auth.requestApproval({ epk: EPK, scope: 'k' }), pastLimit: (c) => c.auth.requestApproval({ epk: 'AQEB', scope: 'k' }) },
  { name: 'redeem authreply: not empty', parameter: 'authreply', atLimit: (c) => c.auth.redeemApproval({ authreply: 'r', scope: 'k' }), pastLimit: (c) => c.auth.redeemApproval({ authreply: '', scope: 'k' }) },
  { name: 'redeem scope: 1023 characters, not 1024', parameter: 'scope', atLimit: (c) => c.auth.redeemApproval({ authreply: 'r', scope: chars(1023) }), pastLimit: (c) => c.auth.redeemApproval({ authreply: 'r', scope: chars(1024) }) },
];

describe('documented limits', () => {
  // verifies: REQ-API-005
  it.each(LIMITS)('$name: the first value past the limit is refused with zero fetch calls, the boundary value is sent', async ({ parameter, atLimit, pastLimit }) => {
    const fake = device();
    const client = loggedInClient(fake);
    const error = await pastLimit(client).then(() => undefined, (e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);

    await atLimit(client);
    expect(operationRequests(fake)).toHaveLength(1);
  });

  it('covers every validated parameter at least once', () => {
    const parameters = new Set(LIMITS.map((limit) => limit.parameter));
    expect([...parameters].sort()).toEqual(['authreply', 'body', 'count', 'ct', 'ctx', 'descr', 'epk', 'file', 'iv', 'kid', 'label', 'limit', 'mac', 'msg', 'note', 'offset', 'peer', 'peer.extKid', 'peer.pubkey', 'pubkey', 'scope', 'sign', 'tag']);
  });
});
