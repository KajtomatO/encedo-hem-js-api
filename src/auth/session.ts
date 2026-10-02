// Session engine: login with the passphrase and the credential lifecycle.
// implements: REQ-AUTH-001, REQ-AUTH-006, REQ-AUTH-011, REQ-API-009

import { decodeBase64 } from "../codec/base64.js";
import { HemProtocolError, HemUnauthenticatedError } from "../errors.js";
import { x25519 } from "../crypto/shim.js";
import { getChallenge, postProof, type LoginChallenge } from "../api/auth-calls.js";
import type { ClientContext } from "../internal/context.js";
import type { CallOptions } from "../transport/transport.js";
import { buildProof, deriveLoginKey, type LoginKey } from "./ejwt.js";
import { decodeJwtClaims, roleFromSub, type HemRole } from "./token.js";

/** Default requested token lifetime: 8 hours. */
export const DEFAULT_TOKEN_LIFETIME_SECONDS = 28_800;

/** A bearer token held in memory for one exact scope. */
export interface TokenEntry {
  readonly token: string;
  readonly scope: string;
  /** Expiry in Unix seconds. */
  readonly exp: number;
  readonly role: HemRole | undefined;
}

export interface SessionOptions {
  passphrase?: string | undefined;
  lifetimeSeconds: number;
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export class Session {
  readonly lifetimeSeconds: number;
  readonly #ctx: ClientContext;
  #passphrase: string | undefined;
  #key: Promise<LoginKey> | undefined;
  #loggedOut = false;
  /** Bumped on logout so that logins in flight cannot repopulate the cache. */
  protected generation = 0;
  protected readonly tokens = new Map<string, TokenEntry>();

  constructor(ctx: ClientContext, options: SessionOptions) {
    this.#ctx = ctx;
    this.#passphrase = options.passphrase;
    this.lifetimeSeconds = options.lifetimeSeconds;
  }

  get loggedOut(): boolean {
    return this.#loggedOut;
  }

  get hasPassphraseCredential(): boolean {
    return this.#passphrase !== undefined || this.#key !== undefined;
  }

  /** Discards the credential and every cached token. */
  logout(): void {
    this.#loggedOut = true;
    this.#passphrase = undefined;
    this.#key = undefined;
    this.tokens.clear();
    this.generation++;
  }

  /**
   * One passphrase login for `scope`: challenge, derive (first time only),
   * agree, prove, submit. Errors never carry the passphrase, proof or token.
   */
  async passphraseLogin(scope: string, options: CallOptions = {}): Promise<{ entry: TokenEntry; challenge: LoginChallenge }> {
    this.#assertCredential();
    const challenge = await getChallenge(this.#ctx, options);
    const key = await this.#loginKey(challenge.eid);
    let spk: Uint8Array;
    try {
      spk = decodeBase64(challenge.spk);
    } catch {
      spk = new Uint8Array();
    }
    if (spk.length !== 32) {
      throw new HemProtocolError('auth.login: challenge field "spk" does not decode to 32 bytes', { operation: "auth.login" });
    }
    const secret = await x25519(key.privateKey, spk);
    const iat = nowSeconds();
    const exp = iat + this.lifetimeSeconds;
    let proof: string;
    try {
      proof = await buildProof({ jti: challenge.jti, aud: challenge.spk, exp, iat, iss: key.iss, scope }, secret);
    } finally {
      secret.fill(0);
    }
    const token = await postProof(this.#ctx, proof, options);
    return { entry: makeEntry(token, scope, exp), challenge };
  }

  #assertCredential(): void {
    if (this.#loggedOut) {
      throw new HemUnauthenticatedError("auth.login: the client is logged out; create a new client to log in again", {
        operation: "auth.login",
      });
    }
    if (!this.hasPassphraseCredential) {
      throw new HemUnauthenticatedError("auth.login: no credential is configured", { operation: "auth.login" });
    }
  }

  /** Derives the login key once, bound to the `eid` it was derived for; the passphrase is then dropped. */
  async #loginKey(eid: string): Promise<LoginKey> {
    if (this.#key === undefined) {
      const passphrase = this.#passphrase!;
      this.#passphrase = undefined;
      this.#key = deriveLoginKey(passphrase, eid);
      this.#key.catch(() => {});
    }
    const key = await this.#key;
    if (key.eid !== eid) {
      throw new HemUnauthenticatedError(
        "auth.login: the device identity changed (the challenge eid differs from the one the login key was derived for)",
        { operation: "auth.login" },
      );
    }
    return key;
  }
}

/** Builds a cache entry; expiry from the token's `exp`, else the requested expiry. */
export function makeEntry(token: string, scope: string, fallbackExp: number): TokenEntry {
  const claims = decodeJwtClaims(token);
  return { token, scope, exp: claims?.exp ?? fallbackExp, role: roleFromSub(claims?.sub) };
}
