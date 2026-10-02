// Bindings of the crypto group.

import type { ClientContext } from "../internal/context.js";

/** `client.crypto`: cryptographic operations with stored keys. */
export interface CryptoApi {}

export class CryptoApiImpl implements CryptoApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }
}
