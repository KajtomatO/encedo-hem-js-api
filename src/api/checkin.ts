// Check-in: the two device steps and the one-call run around a relay.
// implements: REQ-SYS-004, REQ-SYS-005, REQ-SYS-007

import { HemError, HemRelayError, HemUnsupportedError } from "../errors.js";
import { callOptions, sendPublic, type ClientContext } from "../internal/context.js";
import { optString, parseObject, reqString } from "../internal/parse.js";
import type { CallOptions } from "../transport/transport.js";

/** Result of the second check-in step. */
export interface CheckinResult {
  /** The executed management action: `OK`, `L`, `W`, `R`, `B`, `U` or `???`. */
  readonly status: string;
  /** `OK` or `ERROR` when the backend pushed a TLS certificate. */
  readonly newcrt: string | undefined;
  /** A newly available firmware signature, when reported. */
  readonly newfws: string | undefined;
  /** Mass-storage hardware: a newly available dashboard signature, when reported. */
  readonly newuis: string | undefined;
}

export async function getCheckin(ctx: ClientContext, options?: CallOptions): Promise<string> {
  const operation = "system.getCheckin";
  const res = await sendPublic(ctx, { operation, method: "GET", path: "/api/system/checkin", ...callOptions(options) });
  return reqString(parseObject(res, operation), "check", operation);
}

export async function postCheckin(ctx: ClientContext, checked: string, options?: CallOptions): Promise<CheckinResult> {
  const operation = "system.postCheckin";
  const res = await sendPublic(ctx, {
    operation,
    method: "POST",
    path: "/api/system/checkin",
    body: { checked },
    ...callOptions(options),
  });
  const o = parseObject(res, operation);
  return {
    status: reqString(o, "status", operation),
    newcrt: optString(o, "newcrt", operation),
    newfws: optString(o, "newfws", operation),
    newuis: optString(o, "newuis", operation),
  };
}

/**
 * Runs step 1, the relay exchange and step 2 in order. A failure carries the
 * failing leg as `operation`: `system.getCheckin`, `checkinRelay.exchange` or
 * `system.postCheckin`. Never triggers clock recovery (no login is involved).
 */
export async function runCheckin(ctx: ClientContext, options?: CallOptions): Promise<CheckinResult> {
  const relay = ctx.checkinRelay;
  if (!relay) {
    throw new HemUnsupportedError("system.checkin: no check-in relay is configured", { operation: "system.checkin" });
  }
  const check = await getCheckin(ctx, options);
  let checked: string;
  try {
    checked = await relay.exchange(check, callOptions(options));
  } catch (e) {
    if (e instanceof HemError) {
      e.operation = "checkinRelay.exchange";
      throw e;
    }
    throw new HemRelayError("checkinRelay.exchange: the check-in relay failed", { operation: "checkinRelay.exchange", cause: e });
  }
  if (typeof checked !== "string") {
    throw new HemRelayError("checkinRelay.exchange: the relay returned no reply string", { operation: "checkinRelay.exchange" });
  }
  return postCheckin(ctx, checked, options);
}
