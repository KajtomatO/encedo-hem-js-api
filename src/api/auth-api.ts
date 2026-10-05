/**
 * `client.auth`: the session as seen by the caller.
 *
 * @packageDocumentation
 */
import type { Role, Session } from '../auth/session.js';

/** `client.auth`: role and logout. Tokens are obtained automatically per operation. */
export class AuthApi {
  readonly #session: Session;

  /** @internal */
  constructor(session: Session) {
    this.#session = session;
  }

  /**
   * The role the device granted, read from the `sub` claim of the most
   * recently issued token: user (`U`), master (`M`), or a paired app (any
   * other value, given as `id`). `undefined` before the first login. A
   * master session is refused by every key-management and crypto operation.
   *
   * @remarks Introduced in M1.
   */
  // implements: REQ-AUTH-010
  get role(): Role | undefined {
    return this.#session.role;
  }

  /**
   * Discard the credential and every cached token. Afterwards every
   * authenticated call raises `HemUnauthenticatedError` without contacting
   * the device; public calls keep working. Create a new client to log in
   * again.
   *
   * @remarks Makes no request. Introduced in M1.
   */
  logout(): void {
    this.#session.logout();
  }
}
