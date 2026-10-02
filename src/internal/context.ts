// State shared by the namespaces of one client. Every client owns its own.

import { errorFromStatus } from "../errors.js";
import type { Session } from "../auth/session.js";
import type { CheckinRelay } from "../relay/checkin.js";
import type { CallOptions, DeviceRequest, DeviceResponse, Transport } from "../transport/transport.js";

export interface ClientContext {
  readonly transport: Transport;
  /** Set right after construction of the context. */
  session: Session;
  /** `null` when check-in through a relay is disabled. */
  readonly checkinRelay: CheckinRelay | null;
}

/** Copies only the call options a caller may set. */
export function callOptions(options: CallOptions | undefined): CallOptions {
  return { signal: options?.signal, timeoutMs: options?.timeoutMs };
}

/** Sends a request that needs no token and maps an error status to its error class. */
export async function sendPublic(ctx: ClientContext, req: DeviceRequest): Promise<DeviceResponse> {
  const res = await ctx.transport.send(req);
  if (res.status < 200 || res.status >= 300) throw errorFromStatus(res.status, req.operation, res.text);
  return res;
}
