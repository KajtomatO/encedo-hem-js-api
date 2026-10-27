// A fake device with a working passphrase login, for binding tests.
// supports: REQ-TEST-001
import { HemClient, type HemClientOptions } from '../../src/index.js';
import { FakeFetch } from './fake-fetch.js';
import { claimsOf, issueToken, vectorChallenge } from './login.js';
import { loginVector as v } from './vectors.js';

/** A fake device that answers every login and issues a token for the requested scope. */
export function loginDevice(sub = 'U'): FakeFetch {
  return new FakeFetch().always('GET', '/api/auth/token', { body: vectorChallenge }).always('POST', '/api/auth/token', issueToken(sub));
}

/** A client logged in with the vector passphrase at the vector's time. */
export function loggedInClient(fake: FakeFetch, extra: Partial<HemClientOptions> = {}): HemClient {
  return new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, passphrase: v.passphrase, now: () => v.iat * 1000, checkinRelay: null, ...extra });
}

/** Scopes requested at login, in order. */
export function loginScopes(fake: FakeFetch): string[] {
  return fake.requestsTo('POST', '/api/auth/token').map((request) => claimsOf((request.json() as { auth: string }).auth)['scope'] as string);
}

/** The requests that are not part of a login. */
export function operationRequests(fake: FakeFetch): FakeFetch['requests'] {
  return fake.requests.filter((request) => request.path !== '/api/auth/token');
}
