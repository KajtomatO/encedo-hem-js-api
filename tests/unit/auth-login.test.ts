import { describe, expect, it } from 'vitest';
import { HemClient, HemUnauthenticatedError, HemUnsupportedError, HemValidationError } from '../../src/index.js';
import { loggedInClient, loginDevice, loginScopes } from '../support/device.js';
import { FakeFetch } from '../support/fake-fetch.js';
import { claimsOf, vectorChallenge } from '../support/login.js';

/** The `exp` claim of the proof the client posted. */
function requestedExp(fake: FakeFetch): number {
  const proof = (fake.requestsTo('POST', '/api/auth/token')[0]?.json() as { auth: string }).auth;
  return claimsOf(proof)['exp'] as number;
}

describe('auth.login', () => {
  // verifies: REQ-AUTH-027
  it('logs in for the scope and reports scope, role and expiry — no field holds the token', async () => {
    const fake = loginDevice();
    const session = await loggedInClient(fake).auth.login('keymgmt:list');

    expect(loginScopes(fake)).toEqual(['keymgmt:list']);
    expect(session).toEqual({ scope: 'keymgmt:list', role: { kind: 'user' }, expiresAt: requestedExp(fake) });
    expect(Object.keys(session).sort()).toEqual(['expiresAt', 'role', 'scope']);
  });

  // verifies: REQ-AUTH-027
  it('reuses a valid cached token without a request', async () => {
    const fake = loginDevice();
    const client = loggedInClient(fake);
    const first = await client.auth.login('keymgmt:list');
    const second = await client.auth.login('keymgmt:list');

    expect(second).toEqual(first);
    expect(fake.requestsTo('POST', '/api/auth/token')).toHaveLength(1);
  });

  // verifies: REQ-AUTH-027, REQ-AUTH-010
  it('reports the master role from a token with sub M', async () => {
    const session = await loggedInClient(loginDevice('M')).auth.login('keymgmt:list');
    expect(session.role).toEqual({ kind: 'master' });
  });

  // verifies: REQ-AUTH-027
  it('fails as the login itself fails: HemUnauthenticatedError for a wrong passphrase', async () => {
    const fake = new FakeFetch().always('GET', '/api/auth/token', { body: vectorChallenge }).always('POST', '/api/auth/token', { status: 401 });
    await expect(loggedInClient(fake).auth.login('keymgmt:list')).rejects.toThrow(HemUnauthenticatedError);
  });

  // verifies: REQ-AUTH-027
  it('raises HemUnsupportedError on a client without credentials, and HemValidationError for an empty scope', async () => {
    const fake = new FakeFetch();
    await expect(new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, checkinRelay: null }).auth.login('keymgmt:list')).rejects.toThrow(HemUnsupportedError);
    expect(() => loggedInClient(loginDevice()).auth.login('')).toThrow(HemValidationError);
    expect(fake.requests).toHaveLength(0);
  });
});
