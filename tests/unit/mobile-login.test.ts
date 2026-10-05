import { describe, expect, it } from 'vitest';
import {
  type ApprovalCheck,
  type ApprovalRelay,
  type ApprovalSubmission,
  HemClient,
  type HemClientOptions,
  HemUnsupportedError,
  HemValidationError,
} from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, fakeToken } from '../support/login.js';

const NOW_S = 1_800_000_000;
const EPK = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const KID_A = '0123456789abcdef0123456789abcdef';
const KID_B = 'fedcba9876543210fedcba9876543210';

/** An in-memory relay that approves every request at once; the reply names the requested scope. */
class ApprovingRelay implements ApprovalRelay {
  readonly scopes: string[] = [];
  readonly #requests = new Map<string, string>();
  getKey(): Promise<string> {
    return Promise.resolve(EPK);
  }
  submit(submission: ApprovalSubmission): Promise<string> {
    const scope = claimsOf(submission.authreq)['scope'] as string;
    this.scopes.push(scope);
    const handle = `event-${this.scopes.length}`;
    this.#requests.set(handle, scope);
    return Promise.resolve(handle);
  }
  check(handle: string): Promise<ApprovalCheck> {
    return Promise.resolve({ status: 'approved', authreply: `reply-for:${this.#requests.get(handle) ?? ''}` });
  }
}

/** A device that builds an authorization request echoing the scope, and issues a token for the approved scope. */
function device(): FakeFetch {
  return new FakeFetch()
    .always('POST', '/api/auth/ext/request', (request) => {
      const { scope } = request.json() as { scope: string };
      return { body: { authreq: fakeToken({ iat: NOW_S, scope }), epk: EPK } };
    })
    .always('POST', '/api/auth/ext/token', (request) => {
      const scope = (request.json() as { authreply: string }).authreply.replace('reply-for:', '');
      return { body: { token: fakeToken({ sub: 'YXBwLWlk', scope, exp: NOW_S + 900 }) } };
    })
    .always('POST', '/api/crypto/hmac/hash', { body: { mac: 'AAAA' } })
    .always('POST', '/api/keymgmt/create', { body: { kid: KID_A } });
}

const mobileClient = (fake: FakeFetch, relay: ApprovalRelay | null, extra: Partial<HemClientOptions> = {}): HemClient =>
  new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, now: () => NOW_S * 1000, checkinRelay: null, approvalRelay: relay, mobileApproval: { intervalMs: 1 }, ...extra });
const bearerScopes = (fake: FakeFetch, path: string): unknown[] =>
  fake.requestsTo('POST', path).map((request) => claimsOf((request.headers['authorization'] as string).replace('Bearer ', ''))['scope']);

describe('mobile login mode', () => {
  // verifies: REQ-AUTH-019
  it('obtains a token for an operation by one approval of exactly its scope, then proceeds', async () => {
    const fake = device();
    const relay = new ApprovingRelay();
    const client = mobileClient(fake, relay);

    await client.crypto.hmac({ kid: KID_A, msg: Uint8Array.from([1]) });

    expect(relay.scopes).toEqual([`keymgmt:use:${KID_A}`]);
    expect(fake.requests.map((r) => r.path)).toEqual(['/api/auth/ext/request', '/api/auth/ext/token', '/api/crypto/hmac/hash']);
    expect(bearerScopes(fake, '/api/crypto/hmac/hash')).toEqual([`keymgmt:use:${KID_A}`]);
    expect(client.auth.role).toEqual({ kind: 'app', id: 'YXBwLWlk' });
  });

  // verifies: REQ-AUTH-019
  it('causes no new approval while the token is valid, and one per distinct scope', async () => {
    const fake = device();
    const relay = new ApprovingRelay();
    const client = mobileClient(fake, relay);

    await client.crypto.hmac({ kid: KID_A, msg: Uint8Array.from([1]) });
    await client.crypto.hmac({ kid: KID_A, msg: Uint8Array.from([2]) });
    await client.crypto.hmac({ kid: KID_B, msg: Uint8Array.from([3]) });
    await client.keys.create({ label: 'k', type: 'AES256' });
    await client.keys.create({ label: 'k2', type: 'AES256' });

    expect(relay.scopes).toEqual([`keymgmt:use:${KID_A}`, `keymgmt:use:${KID_B}`, 'keymgmt:gen']);
  });

  // verifies: REQ-AUTH-019
  it('rejects a client configured with both a passphrase and mobile mode', () => {
    const fake = device();
    const error = (() => {
      try {
        mobileClient(fake, new ApprovingRelay(), { passphrase: 'secret' });
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('mobileApproval');
  });

  // verifies: REQ-AUTH-019
  it('answers a 401 on an approved token with one new approval and one repeated call', async () => {
    const fake = device().on('POST', '/api/crypto/hmac/hash', { status: 401 });
    const relay = new ApprovingRelay();
    const client = mobileClient(fake, relay);

    await client.crypto.hmac({ kid: KID_A, msg: Uint8Array.from([1]) });

    expect(relay.scopes).toEqual([`keymgmt:use:${KID_A}`, `keymgmt:use:${KID_A}`]);
    expect(fake.requests.map((r) => r.path)).toEqual([
      '/api/auth/ext/request',
      '/api/auth/ext/token',
      '/api/crypto/hmac/hash',
      '/api/auth/ext/request',
      '/api/auth/ext/token',
      '/api/crypto/hmac/hash',
    ]);
  });

  // verifies: REQ-AUTH-016, REQ-AUTH-019
  it('raises HemUnsupportedError with the relay set to none, while the two device calls still work', async () => {
    const fake = device();
    const client = mobileClient(fake, null);
    await expect(client.crypto.hmac({ kid: KID_A, msg: Uint8Array.from([1]) })).rejects.toThrow(HemUnsupportedError);
    expect(fake.requests).toHaveLength(0);
    await expect(client.auth.requestApproval({ epk: EPK, scope: 'keymgmt:list' })).resolves.toMatchObject({ epk: EPK });
    await expect(client.auth.redeemApproval({ authreply: 'reply-for:keymgmt:list', scope: 'keymgmt:list' })).resolves.toMatch(/\./);
  });

  it('accepts true for the default settings', () => {
    expect(() => new HemClient({ url: 'https://my.ence.do', fetch: device().fetch, mobileApproval: true })).not.toThrow();
  });
});
