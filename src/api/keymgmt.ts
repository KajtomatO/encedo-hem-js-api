// Bindings of the keymgmt group.

import type { ClientContext } from "../internal/context.js";

/** `client.keys`: key management. */
export interface KeysApi {}

export class KeysApiImpl implements KeysApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }
}
