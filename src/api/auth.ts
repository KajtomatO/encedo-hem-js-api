// Bindings of the auth group.

import type { HemRole } from "../auth/token.js";
import { callOptions, type ClientContext } from "../internal/context.js";
import { validateScope } from "../internal/scope.js";
import type { CallOptions } from "../transport/transport.js";
import { getChallenge, type LoginChallenge } from "./auth-calls.js";

/** What a login produced, without the token itself. */
export interface SessionInfo {
  /** The exact scope the token carries. */
  readonly scope: string;
  /** The role the device granted, from the token's `sub` claim. */
  readonly role: HemRole | undefined;
  /** Token expiry, Unix seconds. */
  readonly expiresAt: number;
}

/** `client.auth`: login, session and mobile approval. */
export interface AuthApi {
  /**
   * Fetches a login challenge (`GET /api/auth/token`). Logins do this
   * themselves; the call exists for diagnostics.
   *
   * @scope none
   * @milestone M1
   */
  getChallenge(options?: CallOptions): Promise<LoginChallenge>;

  /**
   * Makes sure a token for `scope` is held, logging in when needed
   * (`GET` then `POST /api/auth/token`). Operations do this on their own;
   * call it to log in eagerly or to learn the granted role.
   *
   * @scope none (the login itself is unauthenticated; it obtains a token of `scope`)
   * @milestone M1
   */
  login(scope: string, options?: CallOptions): Promise<SessionInfo>;

  /**
   * The role the device granted in the most recently obtained token: user
   * (`sub` `U`), master (`M`) or a paired app (its key id). `undefined`
   * before the first login.
   *
   * @scope none
   * @milestone M1
   */
  getRole(): HemRole | undefined;

  /**
   * Discards the credential and every cached token. Afterwards every
   * authenticated call fails with `HemUnauthenticatedError` without a request.
   *
   * @scope none
   * @milestone M1
   */
  logout(): void;
}

export class AuthApiImpl implements AuthApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }

  getChallenge(options?: CallOptions): Promise<LoginChallenge> {
    return getChallenge(this.#ctx, callOptions(options));
  }

  async login(scope: string, options?: CallOptions): Promise<SessionInfo> {
    const s = validateScope(scope);
    const entry = await this.#ctx.session.token(s, callOptions(options));
    return { scope: entry.scope, role: entry.role, expiresAt: entry.exp };
  }

  getRole(): HemRole | undefined {
    return this.#ctx.session.role;
  }

  logout(): void {
    this.#ctx.session.logout();
  }
}
