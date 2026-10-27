/**
 * Passphrase login: challenge, key derivation, proof, token.
 *
 * @packageDocumentation
 */
import { getChallenge, postProof } from '../api/auth.js';
import type { BindingContext } from '../api/core.js';
import { HemForbiddenError, HemUnauthenticatedError, HemValidationError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';
import { type LoginKey, buildLoginProof, deriveLoginKey } from './ejwt.js';
import { ClockRecovery, showsDrift } from './recovery.js';

/** Default requested token lifetime: 8 hours. */
export const DEFAULT_TOKEN_LIFETIME_SECONDS = 28_800;

/** Source of the current time in milliseconds since the Unix epoch. */
export type Clock = () => number;

/** Check a requested token lifetime. */
// implements: REQ-AUTH-006
export function validateLifetime(value: unknown, parameter = 'tokenLifetimeSeconds'): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new HemValidationError(`Invalid ${parameter}: must be a positive whole number of seconds`, { parameter });
  }
  return value;
}

/** A token issued by the device, with the expiry that was requested for it. */
export interface IssuedToken {
  readonly token: string;
  /** The `exp` claim of the proof, Unix seconds. */
  readonly requestedExp: number;
}

/**
 * Obtains tokens with a passphrase. The passphrase is kept only until the
 * first challenge arrives: its `eid` is the PBKDF2 salt. After that only the
 * derived, non-extractable key is held, bound to that `eid`.
 */
// implements: REQ-AUTH-001, REQ-AUTH-011
export class PassphraseLogin {
  readonly #context: BindingContext;
  readonly #lifetimeSeconds: number;
  readonly #now: Clock;
  readonly #recovery: ClockRecovery;
  #passphrase: string | undefined;
  #derivation: Promise<LoginKey> | undefined;
  #discarded = false;
  /** Errors of this login that point at the device clock. */
  readonly #clockErrors = new WeakSet<object>();

  constructor(context: BindingContext, passphrase: string, lifetimeSeconds: number, now: Clock, recovery: ClockRecovery = new ClockRecovery(null)) {
    this.#context = context;
    this.#passphrase = passphrase;
    this.#lifetimeSeconds = lifetimeSeconds;
    this.#now = now;
    this.#recovery = recovery;
  }

  /**
   * Log in for `scope`. Each request has its own time limit. When the
   * device clock blocks the login — the challenge is refused with 403, or
   * the proof with 401 while the challenge shows drift — one check-in runs
   * and the login is repeated once with a fresh challenge.
   */
  // implements: REQ-AUTH-009
  acquire(scope: string, options: CallOptions = {}): Promise<IssuedToken> {
    return this.#recovery.once(() => this.#attempt(scope, options), (error) => typeof error === 'object' && error !== null && this.#clockErrors.has(error), options);
  }

  async #attempt(scope: string, options: CallOptions): Promise<IssuedToken> {
    this.#ensureUsable();
    let challenge;
    try {
      challenge = await getChallenge(this.#context, options);
    } catch (error) {
      // 403 on the challenge: trusted time is on and the clock is not set.
      if (error instanceof HemForbiddenError && error.status === 403) this.#clockErrors.add(error);
      throw error;
    }
    const key = await this.#key(challenge.eid);
    if (key.eid !== challenge.eid) {
      throw new HemUnauthenticatedError(
        'auth.login: the device identity changed (the challenge eid differs from the one the credential was derived for); create a new client with the passphrase',
        { operation: 'auth.login' },
      );
    }
    // The proof's exp is local time plus the lifetime; the challenge's own exp is only the submission deadline.
    const iat = Math.floor(this.#now() / 1000);
    const exp = iat + this.#lifetimeSeconds;
    const proof = await buildLoginProof(key, { jti: challenge.jti, spk: challenge.spk, exp, iat, scope });
    try {
      const token = await postProof(this.#context, proof, options);
      return { token, requestedExp: exp };
    } catch (error) {
      // 401 with drift evidence: the device clock, not the passphrase. Without drift it is a wrong passphrase.
      if (error instanceof HemUnauthenticatedError && error.status === 401 && showsDrift(challenge.exp, this.#now())) {
        this.#clockErrors.add(error);
      }
      throw error;
    }
  }

  /** Forget the passphrase and the derived key. */
  discard(): void {
    this.#discarded = true;
    this.#passphrase = undefined;
    this.#derivation = undefined;
  }

  #ensureUsable(): void {
    if (this.#discarded) throw new HemUnauthenticatedError('auth.login: logged out; the credential was discarded', { operation: 'auth.login' });
  }

  /** The derived key; derived once from the passphrase and the first challenge's eid. */
  #key(eid: string): Promise<LoginKey> {
    if (!this.#derivation) {
      const passphrase = this.#passphrase as string;
      const derivation = deriveLoginKey(passphrase, eid);
      this.#derivation = derivation;
      derivation.then(
        () => {
          if (this.#derivation === derivation) this.#passphrase = undefined;
        },
        () => {
          if (this.#derivation === derivation) this.#derivation = undefined;
        },
      );
    }
    return this.#derivation;
  }
}
