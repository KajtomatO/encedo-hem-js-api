// Bindings of the system group.

import type { ClientContext } from "../internal/context.js";

/** `client.system`: device status, version, health and check-in. */
export interface SystemApi {}

export class SystemApiImpl implements SystemApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }
}
