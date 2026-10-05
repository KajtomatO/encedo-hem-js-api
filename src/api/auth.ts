/**
 * Auth device calls used by the session engine: the login challenge and the
 * login proof. Neither carries a token.
 *
 * @packageDocumentation
 */
import { HemProtocolError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { type BindingContext, type OperationSpec, invoke, readInteger, readString } from './core.js';
import { base64ToBytes } from '../codec/base64.js';

export const AUTH_CHALLENGE: OperationSpec = {
  name: 'auth.challenge',
  group: 'auth',
  method: 'GET',
  path: '/api/auth/token',
  scope: null,
  tlsOnly: false,
  required: ['exp', 'spk', 'jti', 'lbl', 'eid'],
};

export const AUTH_LOGIN: OperationSpec = {
  name: 'auth.login',
  group: 'auth',
  method: 'POST',
  path: '/api/auth/token',
  scope: null,
  tlsOnly: false,
  required: ['token'],
  sensitive: true,
};

/** Login challenge from `GET /api/auth/token`. */
export interface LoginChallenge {
  /** Device identity public key, base64 text; also the PBKDF2 salt. */
  readonly eid: string;
  /** Per-boot session public key, base64 text of 32 bytes. */
  readonly spk: string;
  /** Single-use nonce. */
  readonly jti: string;
  /** Proof submission deadline, device time, Unix seconds. */
  readonly exp: number;
  /** Configured user label. */
  readonly lbl: string;
}

/** Fetch a login challenge. */
// implements: REQ-AUTH-001
export async function getChallenge(context: BindingContext, options?: CallOptions): Promise<LoginChallenge> {
  const spec = AUTH_CHALLENGE;
  const r = await invoke(context, spec, {}, options);
  const challenge = {
    eid: readString(spec, r, 'eid'),
    spk: readString(spec, r, 'spk'),
    jti: readString(spec, r, 'jti'),
    exp: readInteger(spec, r, 'exp'),
    lbl: readString(spec, r, 'lbl'),
  };
  let spk: Uint8Array;
  try {
    spk = base64ToBytes(challenge.spk);
  } catch (error) {
    throw new HemProtocolError(`${spec.name}: response field "spk" is not valid base64`, { operation: spec.name, cause: error });
  }
  if (spk.length !== 32) throw new HemProtocolError(`${spec.name}: response field "spk" is not a 32-byte key`, { operation: spec.name });
  return challenge;
}

/** Submit a login proof; returns the issued bearer token. */
// implements: REQ-AUTH-001
export async function postProof(context: BindingContext, proof: string, options?: CallOptions): Promise<string> {
  const r = await invoke(context, AUTH_LOGIN, { body: { auth: proof } }, options);
  if (typeof r['token'] !== 'string' || r['token'] === '') {
    throw new HemProtocolError(`${AUTH_LOGIN.name}: response field "token" is not a string`, { operation: AUTH_LOGIN.name });
  }
  return r['token'];
}

export const AUTH_EXT_REQUEST: OperationSpec = {
  name: 'auth.requestApproval',
  group: 'auth',
  method: 'POST',
  path: '/api/auth/ext/request',
  scope: null,
  tlsOnly: false,
  required: ['authreq', 'epk'],
};

export const AUTH_EXT_TOKEN: OperationSpec = {
  name: 'auth.redeemApproval',
  group: 'auth',
  method: 'POST',
  path: '/api/auth/ext/token',
  scope: null,
  tlsOnly: false,
  required: ['token'],
  sensitive: true,
};

/** Redeem a paired app's reply for a bearer token (no caching). */
// implements: REQ-AUTH-015
export async function redeemReply(context: BindingContext, authreply: string, options?: CallOptions): Promise<string> {
  const r = await invoke(context, AUTH_EXT_TOKEN, { body: { authreply } }, options);
  const token = r['token'];
  if (typeof token !== 'string' || token === '') {
    throw new HemProtocolError(`${AUTH_EXT_TOKEN.name}: response field "token" is not a string`, { operation: AUTH_EXT_TOKEN.name });
  }
  return token;
}

/** Operations of this module. */
export const AUTH_OPERATIONS: readonly OperationSpec[] = [AUTH_CHALLENGE, AUTH_LOGIN, AUTH_EXT_REQUEST, AUTH_EXT_TOKEN];
