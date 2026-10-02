// State shared by the namespaces of one client. Every client owns its own.

import { errorFromStatus } from "../errors.js";
import type { DeviceRequest, DeviceResponse, Transport } from "../transport/transport.js";

export interface ClientContext {
  readonly transport: Transport;
}

/** Sends a request that needs no token and maps an error status to its error class. */
export async function sendPublic(ctx: ClientContext, req: DeviceRequest): Promise<DeviceResponse> {
  const res = await ctx.transport.send(req);
  if (res.status < 200 || res.status >= 300) throw errorFromStatus(res.status, req.operation, res.text);
  return res;
}
