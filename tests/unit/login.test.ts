import { describe, expect, it, vi } from 'vitest';
import { AUTH_CHALLENGE, AUTH_LOGIN } from '../../src/api/auth.js';
import { invoke, noTokens } from '../../src/api/core.js';
import { contextOf } from '../../src/client.js';
import { DEFAULT_TOKEN_LIFETIME_SECONDS, PassphraseLogin } from '../../src/auth/login.js';
import {
  HemClient,
  type HemClientOptions,
  HemDeviceStateError,
  HemError,
  HemProtocolError,
  HemUnauthenticatedError,
  HemValidationError,
} from '../../src/index.js';
import { Transport } from '../../src/transport/transport.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, fakeToken, vectorChallenge } from '../support/login.js';
import { loginVector as v } from '../support/vectors.js';

const TOKEN = fakeToken({ sub: 'U', scope: v.scope, exp: v.exp });
const atVectorTime = (): number => v.iat * 1000 + 999; // sub-second part is dropped

function login(fake: FakeFetch, lifetime = 3600, passphrase: string = v.passphrase): PassphraseLogin {
  const context = { transport: new Transport({ url: 'https://my.ence.do', fetch: fake.fetch }), tokens: noTokens };
  return new PassphraseLogin(context, passphrase, lifetime, atVectorTime);
}

describe('passphrase login', () => {
  // verifies: REQ-AUTH-001, REQ-AUTH-002
  it('makes one GET then one POST without Authorization, posting exactly the vector proof', async () => {
    const fake = new FakeFetch().on('GET', '/api/auth/token', { body: vectorChallenge }).on('POST', '/api/auth/token', { body: { token: TOKEN } });

    const issued = await login(fake).acquire(v.scope);

    expect(issued).toEqual({ token: TOKEN, requestedExp: v.exp });
    expect(fake.requests.map((r) => `${r.method} ${r.path}`)).toEqual(['GET /api/auth/token', 'POST /api/auth/token']);
    expect(fake.requests.map((r) => r.headers['authorization'])).toEqual([undefined, undefined]);
    expect(fake.requests[0]?.headers).toEqual({});
    expect(fake.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(fake.last.text()).toBe(JSON.stringify({ auth: `${v.header}.${v.claims}.${v.tag}` }));
  }, 60_000);

  // verifies: REQ-AUTH-001
  it.each(['eid', 'spk', 'jti'])('raises HemProtocolError for a challenge missing %s', async (field) => {
    const challenge: Record<string, unknown> = { ...vectorChallenge };
    delete challenge[field];
    const fake = new FakeFetch().on('GET', '/api/auth/token', { body: challenge });
    await expect(login(fake).acquire(v.scope)).rejects.toThrow(HemProtocolError);
    expect(fake.requests).toHaveLength(1);
  });

  // verifies: REQ-AUTH-001
  it.each(['AQID', 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQ==', 'not*base64'])(
    'raises HemProtocolError for an spk %j that does not decode to 32 bytes',
    async (spk) => {
      const fake = new FakeFetch().on('GET', '/api/auth/token', { body: { ...vectorChallenge, spk } });
      await expect(login(fake).acquire(v.scope)).rejects.toThrow(HemProtocolError);
      expect(fake.requests).toHaveLength(1);
    },
  );

  // verifies: REQ-AUTH-001
  it.each([{}, { token: 42 }, { token: '' }])('raises HemProtocolError for a proof reply %j without a token', async (reply) => {
    const fake = new FakeFetch().on('GET', '/api/auth/token', { body: vectorChallenge }).on('POST', '/api/auth/token', { body: reply });
    await expect(login(fake).acquire(v.scope)).rejects.toThrow(HemProtocolError);
  }, 60_000);

  // verifies: REQ-AUTH-001
  it('raises HemUnauthenticatedError for a 401 on the proof, and HemDeviceStateError for a 409', async () => {
    const fake = new FakeFetch()
      .always('GET', '/api/auth/token', { body: vectorChallenge })
      .on('POST', '/api/auth/token', { status: 401 }, { status: 409 });
    const session = login(fake);
    await expect(session.acquire(v.scope)).rejects.toThrow(HemUnauthenticatedError);
    await expect(session.acquire(v.scope)).rejects.toThrow(HemDeviceStateError);
  }, 60_000);

  it('raises HemDeviceStateError for a 409 on the challenge (device not initialised)', async () => {
    const fake = new FakeFetch().on('GET', '/api/auth/token', { status: 409 });
    await expect(login(fake).acquire(v.scope)).rejects.toThrow(HemDeviceStateError);
  });
});

describe('token lifetime', () => {
  const proofClaims = async (lifetime?: number): Promise<Record<string, unknown>> => {
    // A challenge whose own exp is 60 s ahead, as the device sends it.
    const fake = new FakeFetch().on('GET', '/api/auth/token', { body: vectorChallenge }).on('POST', '/api/auth/token', { body: { token: TOKEN } });
    await login(fake, lifetime).acquire(v.scope);
    return claimsOf((fake.last.json() as { auth: string }).auth);
  };

  // verifies: REQ-AUTH-006
  it('requests 28 800 s by default, not limited by the challenge deadline', async () => {
    expect(DEFAULT_TOKEN_LIFETIME_SECONDS).toBe(28_800);
    const claims = await proofClaims(DEFAULT_TOKEN_LIFETIME_SECONDS);
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(28_800);
    expect(claims['iat']).toBe(v.iat);
    expect(vectorChallenge.exp - v.iat).toBe(60);
  }, 60_000);

  // verifies: REQ-AUTH-006
  it('uses a configured lifetime', async () => {
    const claims = await proofClaims(86_400);
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(86_400);
  }, 60_000);

  // verifies: REQ-AUTH-006
  it('defaults to 28 800 s through the client options', async () => {
    const fake = new FakeFetch()
      .on('GET', '/api/auth/token', { body: vectorChallenge })
      .on('POST', '/api/auth/token', { body: { token: TOKEN } })
      .on('GET', '/api/test', { body: {} });
    const client = new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, passphrase: v.passphrase, now: atVectorTime, checkinRelay: null });
    // A test-only authenticated operation drives the client's session.
    await invoke(contextOf(client), { name: 'test.op', group: 'system', method: 'GET', path: '/api/test', scope: 'system:config', tlsOnly: false, required: [] }, {});
    const claims = claimsOf((fake.requestsTo('POST', '/api/auth/token')[0]?.json() as { auth: string }).auth);
    expect((claims['exp'] as number) - (claims['iat'] as number)).toBe(28_800);
    expect(claims['scope']).toBe('system:config');
    expect(fake.last.headers['authorization']).toBe(`Bearer ${TOKEN}`);
  }, 60_000);

  // verifies: REQ-AUTH-006
  it.each([0, -1, 1.5, Number.NaN, '3600'])('rejects a lifetime of %j with HemValidationError', (tokenLifetimeSeconds) => {
    expect(
      () => new HemClient({ url: 'https://my.ence.do', fetch: new FakeFetch().fetch, passphrase: 'p', tokenLifetimeSeconds } as HemClientOptions),
    ).toThrow(HemValidationError);
  });
});

describe('credential handling', () => {
  // verifies: REQ-AUTH-011
  it('runs PBKDF2 once across two logins, keeps the key bound to its eid, and cannot re-derive it for another eid', async () => {
    const deriveBits = vi.spyOn(SubtleCrypto.prototype, 'deriveBits');
    try {
      const fake = new FakeFetch()
        .on('GET', '/api/auth/token', { body: vectorChallenge }, { body: { ...vectorChallenge, jti: 'other-nonce' } }, { body: { ...vectorChallenge, eid: 'ZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmY=' } })
        .always('POST', '/api/auth/token', { body: { token: TOKEN } });
      const session = login(fake);

      await session.acquire(v.scope);
      await session.acquire(v.scope);
      // deriveBits also serves the X25519 agreement of every login; only the PBKDF2 runs count.
      const pbkdf2Runs = deriveBits.mock.calls.filter(([algorithm]) => (algorithm as { name?: string }).name === 'PBKDF2');
      expect(pbkdf2Runs).toHaveLength(1);

      // A different eid would need the passphrase again; it is gone, so the key cannot be re-derived.
      const error = await session.acquire(v.scope).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HemUnauthenticatedError);
      expect((error as Error).message).toMatch(/device identity changed/);
      expect(fake.requestsTo('POST', '/api/auth/token')).toHaveLength(2);
      expect(deriveBits.mock.calls.filter(([algorithm]) => (algorithm as { name?: string }).name === 'PBKDF2')).toHaveLength(1);
    } finally {
      deriveBits.mockRestore();
    }
  }, 60_000);

  // verifies: REQ-AUTH-011
  it('holds the private key as a non-extractable CryptoKey', async () => {
    const { deriveLoginKey } = await import('../../src/auth/ejwt.js');
    const key = await deriveLoginKey(v.passphrase, v.eid);
    expect(key.privateKey).toBeInstanceOf(CryptoKey);
    expect(key.privateKey.extractable).toBe(false);
  }, 60_000);

  // verifies: REQ-AUTH-003
  it('offers no option to select another key derivation', () => {
    const options: Required<HemClientOptions> = {
      url: 'https://my.ence.do',
      fetch: new FakeFetch().fetch,
      timeoutMs: 1,
      minIntervalMs: 0,
      checkinRelay: null,
      approvalRelay: null,
      passphrase: 'p',
      mobileApproval: true,
      tokenLifetimeSeconds: 1,
      clockRecovery: true,
      now: Date.now,
    };
    expect(Object.keys(options).filter((name) => /kdf|deriv|argon|pbkdf|iteration|secret|key/i.test(name))).toEqual([]);
  });

  it('rejects an empty or non-string passphrase', () => {
    for (const passphrase of ['', 42]) {
      expect(() => new HemClient({ url: 'https://my.ence.do', fetch: new FakeFetch().fetch, passphrase } as HemClientOptions)).toThrow(HemValidationError);
    }
  });
});

describe('secrets in errors', () => {
  const leaks = (error: unknown, secrets: string[]): string[] => {
    const e = error as HemError;
    const views = [e.message, String(e), JSON.stringify(e), JSON.stringify(e.body ?? null), String(e.bodyText), String(e.cause), String((e.cause as Error | undefined)?.message), e.stack ?? ''];
    return secrets.filter((secret) => views.some((view) => view.includes(secret)));
  };

  // verifies: REQ-API-009
  it('a failed login carries neither the passphrase, the proof nor a token', async () => {
    const proof = `${v.header}.${v.claims}.${v.tag}`;
    const fake = new FakeFetch()
      .always('GET', '/api/auth/token', { body: vectorChallenge })
      .on('POST', '/api/auth/token', { status: 401 }, { body: `{"token":"${TOKEN}"` }, { body: { tokn: TOKEN, auth: proof } }, { status: 400, body: { auth: proof } });
    const session = login(fake);
    for (let i = 0; i < 4; i += 1) {
      const error = await session.acquire(v.scope).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(HemError);
      expect(leaks(error, [v.passphrase, proof, v.tag, TOKEN])).toEqual([]);
    }
  }, 60_000);

  it('describes the auth operations as data', () => {
    expect(AUTH_CHALLENGE).toMatchObject({ method: 'GET', path: '/api/auth/token', scope: null, tlsOnly: false });
    expect(AUTH_LOGIN).toMatchObject({ method: 'POST', path: '/api/auth/token', scope: null, tlsOnly: false, sensitive: true });
  });
});

