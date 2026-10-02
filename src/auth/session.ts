// Session engine: login with the passphrase and the credential lifecycle.
// implements: REQ-AUTH-001, REQ-AUTH-006, REQ-AUTH-011, REQ-API-009
// implements: REQ-AUTH-004, REQ-AUTH-005, REQ-AUTH-007, REQ-AUTH-008, REQ-AUTH-012, REQ-AUTH-013, REQ-AUTH-009

import { decodeBase64 } from "../codec/base64.js";
import { HemAbortError, HemError, HemForbiddenError, HemProtocolError, HemUnauthenticatedError, errorFromStatus } from "../errors.js";
import { runCheckin } from "../api/checkin.js";
import { x25519 } from "../crypto/shim.js";
import { getChallenge, postProof, type LoginChallenge } from "../api/auth-calls.js";
import type { ClientContext } from "../internal/context.js";
import type { CallOptions, DeviceRequest, DeviceResponse } from "../transport/transport.js";
import { buildProof, deriveLoginKey, type LoginKey } from "./ejwt.js";
import { decodeJwtClaims, roleFromSub, type HemRole } from "./token.js";

/** A token within this many seconds of its expiry is renewed before use [C-SDK]. */
export const RENEWAL_MARGIN_SECONDS = 60;

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
  /** Run one check-in and retry when a login fails because the device clock is wrong (default true). */
  clockRecovery?: boolean | undefined;
}

/** Allowed difference between the device clock (from the challenge) and the local clock, in seconds [C-SDK]. */
export const CLOCK_DRIFT_TOLERANCE_SECONDS = 60;
/** The challenge `exp` is device time plus this many seconds [C-SDK]. */
export const CHALLENGE_DEADLINE_SECONDS = 60;

/** True when the challenge shows the device clock differs from the local clock by more than 60 s. */
export function challengeShowsDrift(challengeExp: number | undefined, now = nowSeconds()): boolean {
  if (challengeExp === undefined) return false;
  return Math.abs(challengeExp - CHALLENGE_DEADLINE_SECONDS - now) > CLOCK_DRIFT_TOLERANCE_SECONDS;
}

export const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export class Session {
  readonly lifetimeSeconds: number;
  readonly clockRecovery: boolean;
  readonly #ctx: ClientContext;
  #passphrase: string | undefined;
  #key: Promise<LoginKey> | undefined;
  #loggedOut = false;
  /** Bumped on logout so that logins in flight cannot repopulate the cache. */
  protected generation = 0;
  protected readonly tokens = new Map<string, TokenEntry>();
  readonly #inflight = new Map<string, Promise<TokenEntry>>();
  #role: HemRole | undefined;
  /** Obtains a fresh token for a scope; the passphrase login unless replaced (mobile mode). */
  tokenSource: (scope: string, options: CallOptions) => Promise<TokenEntry> = (scope, options) =>
    this.loginWithClockRecovery(scope, options);

  /**
   * A passphrase login that, when it fails because the device clock is unset
   * (403 on the challenge) or drifted (401 on the proof with drift evidence),
   * runs one check-in and logs in once more with a fresh challenge.
   */
  async loginWithClockRecovery(scope: string, options: CallOptions = {}): Promise<TokenEntry> {
    let recovered = false;
    for (;;) {
      const attempt: { challenge?: LoginChallenge } = {};
      try {
        return (await this.passphraseLogin(scope, options, attempt)).entry;
      } catch (e) {
        const clockError =
          (e instanceof HemForbiddenError && e.operation === "auth.getChallenge") ||
          (e instanceof HemUnauthenticatedError &&
            e.status === 401 &&
            e.operation === "auth.login" &&
            challengeShowsDrift(attempt.challenge?.exp));
        if (!clockError || recovered) throw e;
        recovered = true;
        await this.recoverClock(e as HemError, options);
      }
    }
  }

  /**
   * Runs the one recovery check-in for a login-type failure. Throws
   * `original` when recovery is off or there is no relay, or with the
   * check-in failure attached as its cause when the check-in fails.
   */
  async recoverClock(original: HemError, options: CallOptions): Promise<void> {
    if (!this.clockRecovery || !this.#ctx.checkinRelay) throw original;
    try {
      await runCheckin(this.#ctx, options);
    } catch (checkinError) {
      Object.defineProperty(original, "cause", { value: checkinError, writable: true, configurable: true, enumerable: false });
      throw original;
    }
  }

  constructor(ctx: ClientContext, options: SessionOptions) {
    this.#ctx = ctx;
    this.#passphrase = options.passphrase;
    this.lifetimeSeconds = options.lifetimeSeconds;
    this.clockRecovery = options.clockRecovery !== false;
  }

  get loggedOut(): boolean {
    return this.#loggedOut;
  }

  get hasPassphraseCredential(): boolean {
    return this.#passphrase !== undefined || this.#key !== undefined;
  }

  /** The role of the most recently obtained token. */
  get role(): HemRole | undefined {
    return this.#role;
  }

  /** Puts a token into the cache under its exact scope. */
  store(entry: TokenEntry): void {
    if (this.#loggedOut) return;
    this.tokens.set(entry.scope, entry);
    if (entry.role !== undefined) this.#role = entry.role;
  }

  /** Drops the cached token of a scope if it is still `token`. */
  invalidate(scope: string, token: string): void {
    if (this.tokens.get(scope)?.token === token) this.tokens.delete(scope);
  }

  /**
   * A valid token for exactly `scope`: from the cache unless it is within
   * 60 s of expiry, else from one login shared by all concurrent callers.
   * A caller's abort only ends that caller's wait.
   */
  async token(scope: string, options: CallOptions = {}): Promise<TokenEntry> {
    if (this.#loggedOut) {
      throw new HemUnauthenticatedError("the client is logged out; create a new client to log in again", {
        operation: "auth.login",
      });
    }
    const cached = this.tokens.get(scope);
    if (cached && cached.exp - nowSeconds() > RENEWAL_MARGIN_SECONDS) return cached;
    let shared = this.#inflight.get(scope);
    if (!shared) {
      const generation = this.generation;
      shared = this.tokenSource(scope, { timeoutMs: options.timeoutMs }).then((entry) => {
        if (generation === this.generation) this.store(entry);
        return entry;
      });
      const settle = () => {
        if (this.#inflight.get(scope) === shared) this.#inflight.delete(scope);
      };
      shared.then(settle, settle);
      this.#inflight.set(scope, shared);
    }
    return raceSignal(shared, options.signal);
  }

  /**
   * Sends a request with a token of `scope`; on 401 the token is dropped, a
   * new one obtained and the request repeated once. Error statuses are mapped.
   */
  async authorized(req: DeviceRequest, scope: string): Promise<DeviceResponse> {
    for (let attempt = 0; ; attempt++) {
      const entry = await this.token(scope, req);
      const res = await this.#ctx.transport.send({ ...req, token: entry.token });
      if (res.status === 401) {
        this.invalidate(scope, entry.token);
        if (attempt === 0) continue;
      }
      if (res.status < 200 || res.status >= 300) throw errorFromStatus(res.status, req.operation, res.text);
      return res;
    }
  }

  /** Discards the credential and every cached token. */
  logout(): void {
    this.#loggedOut = true;
    this.#passphrase = undefined;
    this.#key = undefined;
    this.tokens.clear();
    this.#inflight.clear();
    this.#role = undefined;
    this.generation++;
  }

  /**
   * One passphrase login for `scope`: challenge, derive (first time only),
   * agree, prove, submit. Errors never carry the passphrase, proof or token.
   */
  async passphraseLogin(
    scope: string,
    options: CallOptions = {},
    attempt: { challenge?: LoginChallenge } = {},
  ): Promise<{ entry: TokenEntry; challenge: LoginChallenge }> {
    this.#assertCredential();
    const challenge = await getChallenge(this.#ctx, options);
    attempt.challenge = challenge;
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

function raceSignal<T>(promise: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(new HemAbortError("auth.login: aborted by the caller", { cause: signal.reason }));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new HemAbortError("auth.login: aborted by the caller", { cause: signal.reason }));
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (e: unknown) => {
        signal.removeEventListener("abort", onAbort);
        reject(e);
      },
    );
  });
}

/** Builds a cache entry; expiry from the token's `exp`, else the requested expiry. */
export function makeEntry(token: string, scope: string, fallbackExp: number): TokenEntry {
  const claims = decodeJwtClaims(token);
  return { token, scope, exp: claims?.exp ?? fallbackExp, role: roleFromSub(claims?.sub) };
}
