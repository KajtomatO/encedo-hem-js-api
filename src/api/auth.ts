// Bindings of the auth group.

import type { ClientContext } from "../internal/context.js";

/** `client.auth`: login, session and mobile approval. */
export interface AuthApi {}

export class AuthApiImpl implements AuthApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }
}
