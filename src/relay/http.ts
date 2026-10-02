// HTTP for the cloud relays: their own fetch (never the device one), JSON in
// and out, outside the device request queue.
// implements: REQ-NET-007

import { validateInteger } from "../codec/validate.js";
import { HemProtocolError, HemRelayError } from "../errors.js";
import { DEFAULT_TIMEOUT_MS, fetchWithLimit, type CallOptions, type FetchLike } from "../transport/transport.js";

/** Options shared by the default relays. */
export interface RelayHttpOptions {
  /** `fetch` for the cloud service; the global `fetch` when omitted. Never the device `fetch`. */
  fetch?: FetchLike | undefined;
  /** Time limit of each relay request, in milliseconds (default 30 000). */
  timeoutMs?: number | undefined;
}

export class RelayHttp {
  readonly #fetch: FetchLike | undefined;
  readonly #timeoutMs: number;

  constructor(options: RelayHttpOptions) {
    this.#fetch = options.fetch;
    this.#timeoutMs =
      options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : validateInteger(options.timeoutMs, "timeoutMs", 1);
  }

  async request(
    operation: string,
    method: "GET" | "POST",
    url: string,
    body: unknown,
    options: CallOptions = {},
  ): Promise<{ status: number; text: string }> {
    const init: RequestInit = { method, redirect: "error" };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { "Content-Type": "application/json" };
    }
    const fetchImpl: FetchLike = this.#fetch ?? ((input, i) => globalThis.fetch(input, i));
    const res = await fetchWithLimit(fetchImpl, url, init, {
      operation,
      signal: options.signal,
      timeoutMs: options.timeoutMs ?? this.#timeoutMs,
      what: "relay service",
    });
    return { status: res.status, text: res.text };
  }
}

/** The error for a relay status the protocol does not expect; carries status and body. */
export function relayStatusError(operation: string, res: { status: number; text: string }): HemRelayError {
  return new HemRelayError(`${operation}: unexpected HTTP ${res.status} from the relay service`, {
    operation,
    status: res.status,
    body: res.text,
  });
}

export function relayJson(operation: string, res: { status: number; text: string }): Record<string, unknown> {
  try {
    const v = JSON.parse(res.text) as unknown;
    if (v !== null && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  } catch {
    // fall through
  }
  throw new HemProtocolError(`${operation}: the relay response is not a JSON object`, { operation, status: res.status });
}

export function relayString(operation: string, o: Record<string, unknown>, field: string): string {
  const v = o[field];
  if (typeof v !== "string") {
    throw new HemProtocolError(`${operation}: relay response field "${field}" is missing or not a string`, { operation });
  }
  return v;
}
