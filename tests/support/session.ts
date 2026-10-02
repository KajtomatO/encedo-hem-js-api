// supports: REQ-AUTH-004, REQ-AUTH-005
// Builds a transport + session pair over a fake device, the way HemClient does.
import { Session } from "../../src/auth/session.js";
import type { ClientContext } from "../../src/internal/context.js";
import { Transport } from "../../src/transport/transport.js";
import { fakeDevice, type FakeDevice } from "./device.js";
import { LOGIN_VECTOR } from "./vectors.js";

export function makeSession(
  device: FakeDevice = fakeDevice(),
  options: { lifetimeSeconds?: number; timeoutMs?: number; passphrase?: string } = {},
) {
  const transport = new Transport({ url: "https://my.ence.do", fetch: device.fetch, timeoutMs: options.timeoutMs });
  const ctx = { transport } as ClientContext;
  ctx.session = new Session(ctx, {
    passphrase: options.passphrase ?? LOGIN_VECTOR.passphrase,
    lifetimeSeconds: options.lifetimeSeconds ?? 3600,
  });
  return { device, ctx, session: ctx.session };
}
