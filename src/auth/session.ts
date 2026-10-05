/**
 * The session engine: one cached token per exact scope, renewed on demand
 * before it expires, attached only to operations that declare a scope.
 *
 * @packageDocumentation
 */
import { redact, type TokenProvider } from '../api/core.js';
import { base64ToBytes } from '../codec/base64.js';
import { utf8Decode } from '../codec/utf8.js';
import { HemAbortError, HemError, HemUnauthenticatedError, HemUnsupportedError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import type { Clock, IssuedToken } from './login.js';

/** Seconds before a token's expiry at which it is no longer used. */
export const RENEWAL_MARGIN_SECONDS = 60;

/**
 * The role the device granted, from the `sub` claim of the issued token:
 * `U` is the user, `M` the master, anything else a paired mobile app
 * identified by that value.
 */
export type Role = { readonly kind: 'user' } | { readonly kind: 'master' } | { readonly kind: 'app'; readonly id: string };

/** Something that can obtain a token for a scope: passphrase login or mobile approval. */
export interface TokenSource {
  acquire(scope: string, options: CallOptions): Promise<IssuedToken>;
  /** Forget every credential. */
  discard(): void;
}

interface CachedToken {
  readonly token: string;
  /** Expiry, Unix seconds. */
  readonly exp: number;
  readonly sub: string | undefined;
}

/** Claims of a JWT-shaped token, or `undefined` when it cannot be decoded. */
function decodeClaims(token: string): Record<string, unknown> | undefined {
  const payload = token.split('.')[1];
  if (payload === undefined) return undefined;
  try {
    const claims: unknown = JSON.parse(utf8Decode(base64ToBytes(payload)));
    return typeof claims === 'object' && claims !== null && !Array.isArray(claims) ? (claims as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

/** Map a `sub` claim to a role. */
export function roleOf(sub: string): Role {
  if (sub === 'U') return { kind: 'user' };
  if (sub === 'M') return { kind: 'master' };
  return { kind: 'app', id: sub };
}

/**
 * Wait for a shared promise on behalf of one caller: the caller's abort
 * rejects only this caller's wait, never the shared work.
 */
function waitFor<T>(shared: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (!signal) return shared;
  const abort = (): HemAbortError => new HemAbortError('auth.login: cancelled by the caller', { operation: 'auth.login', cause: signal.reason });
  if (signal.aborted) return Promise.reject(abort());
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(abort());
    signal.addEventListener('abort', onAbort, { once: true });
    shared.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Whether a secret string appears anywhere in an error's visible form. */
function mentions(error: HemError, secret: string): boolean {
  return [error.message, error.bodyText ?? '', JSON.stringify(error), String(error.cause ?? '')].some((text) => text.includes(secret));
}

/**
 * Token cache and acquisition for one client. Tokens live in memory only,
 * keyed by the exact scope string; no timer runs in the background.
 */
// implements: REQ-AUTH-004, REQ-AUTH-005, REQ-AUTH-007, REQ-AUTH-011
export class Session implements TokenProvider {
  readonly #source: TokenSource | null;
  readonly #now: Clock;
  readonly #cache = new Map<string, CachedToken>();
  /** Acquisitions in flight, one per scope, shared by every caller that needs it. */
  readonly #inflight = new Map<string, Promise<CachedToken>>();
  #loggedOut = false;
  #role: Role | undefined;

  constructor(source: TokenSource | null, now: Clock) {
    this.#source = source;
    this.#now = now;
  }

  /** The role of the most recently issued token; `undefined` before the first login. */
  get role(): Role | undefined {
    return this.#role;
  }

  /** Scopes that currently have a cached token. */
  get cachedScopes(): string[] {
    return [...this.#cache.keys()];
  }

  /** Discard the credential and every cached token. Authenticated calls fail afterwards. */
  logout(): void {
    this.#loggedOut = true;
    this.#cache.clear();
    this.#inflight.clear();
    this.#role = undefined;
    this.#source?.discard();
  }

  /**
   * Run `send` with a token for `scope`. After a 401, the token of that scope
   * is discarded, a new one obtained, and `send` repeated exactly once.
   */
  // implements: REQ-AUTH-008
  async withToken<T>(scope: string, options: CallOptions, send: (bearer: string) => Promise<T>): Promise<T> {
    let entry = await this.#token(scope, options);
    try {
      return await this.#send(entry, send);
    } catch (error) {
      if (!(error instanceof HemUnauthenticatedError) || error.status !== 401) throw error;
      // Tokens die when the device reboots; the 401 is how the client finds out.
      if (this.#cache.get(scope) === entry) this.#cache.delete(scope);
      entry = await this.#token(scope, options);
      return await this.#send(entry, send);
    }
  }

  async #send<T>(entry: CachedToken, send: (bearer: string) => Promise<T>): Promise<T> {
    try {
      return await send(entry.token);
    } catch (error) {
      // implements: REQ-API-009 — an error that somehow quotes the token loses its body.
      throw error instanceof HemError && mentions(error, entry.token) ? redact(error) : error;
    }
  }

  /** A usable token for `scope`: the cached one unless it is within the renewal margin. */
  async #token(scope: string, options: CallOptions): Promise<CachedToken> {
    if (this.#loggedOut) {
      throw new HemUnauthenticatedError('Logged out: the credential and all tokens were discarded', { operation: 'auth.login' });
    }
    if (!this.#source) throw new HemUnsupportedError('This client has no credentials for authenticated operations');
    const cached = this.#cache.get(scope);
    if (cached && cached.exp - this.#now() / 1000 > RENEWAL_MARGIN_SECONDS) return cached;
    this.#cache.delete(scope);
    return waitFor(this.#shared(scope, options), options.signal);
  }

  /**
   * The one acquisition in flight for `scope`, started if there is none. It
   * is not tied to any caller's signal, and a failure is not remembered.
   */
  // implements: REQ-AUTH-013, REQ-NET-005
  #shared(scope: string, options: CallOptions): Promise<CachedToken> {
    let pending = this.#inflight.get(scope);
    if (!pending) {
      pending = this.#acquire(scope, { timeoutMs: options.timeoutMs });
      this.#inflight.set(scope, pending);
      const clear = (): void => {
        if (this.#inflight.get(scope) === pending) this.#inflight.delete(scope);
      };
      pending.then(clear, clear);
    }
    return pending;
  }

  async #acquire(scope: string, options: CallOptions): Promise<CachedToken> {
    const issued = await (this.#source as TokenSource).acquire(scope, options);
    const claims = decodeClaims(issued.token);
    const exp = typeof claims?.['exp'] === 'number' && Number.isFinite(claims['exp']) ? claims['exp'] : issued.requestedExp;
    const sub = typeof claims?.['sub'] === 'string' ? claims['sub'] : undefined;
    const entry: CachedToken = { token: issued.token, exp, sub };
    if (this.#loggedOut) {
      throw new HemUnauthenticatedError('Logged out: the credential and all tokens were discarded', { operation: 'auth.login' });
    }
    this.#cache.set(scope, entry);
    // implements: REQ-AUTH-010
    if (sub !== undefined) this.#role = roleOf(sub);
    return entry;
  }
}
