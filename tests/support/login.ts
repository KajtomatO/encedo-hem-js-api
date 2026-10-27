// Helpers for scripting a passphrase login on the fake device.
// supports: REQ-AUTH-001, REQ-TEST-001
import { loginVector as v } from './vectors.js';
import type { Reply } from './fake-fetch.js';

/** The REQ-AUTH-002 challenge, as the device would send it. */
export const vectorChallenge = { eid: v.eid, spk: v.spk, jti: v.jti, exp: v.iat + 60, lbl: 'user' };

/** Base64url JSON segment. */
const segment = (value: unknown): string =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** An unsigned JWT-shaped bearer token with the given claims (the client never verifies it). */
export function fakeToken(claims: Record<string, unknown>): string {
  return `${segment({ alg: 'HS256', typ: 'JWT' })}.${segment(claims)}.c2lnbmF0dXJl`;
}

/** A reply to the proof POST issuing a token whose claims echo the proof's scope and exp. */
export function issueToken(sub = 'U'): Reply {
  return (request) => {
    const proof = (request.json() as { auth: string }).auth;
    const claims = JSON.parse(atob((proof.split('.')[1] as string).replace(/-/g, '+').replace(/_/g, '/'))) as Record<string, unknown>;
    return { body: { token: fakeToken({ sub, scope: claims['scope'], exp: claims['exp'], iat: claims['iat'] }) } };
  };
}

/** Decode the claims segment of a proof or token. */
export function claimsOf(jwt: string): Record<string, unknown> {
  const part = (jwt.split('.')[1] as string).replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(atob(part)) as Record<string, unknown>;
}
