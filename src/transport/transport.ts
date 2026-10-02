// Transport: one device request in, one response out, through the caller's fetch.
// implements: REQ-NET-001, REQ-NET-004, REQ-NET-005, REQ-NET-006, REQ-NET-009, REQ-NET-010, REQ-BUILD-003

import { validateBodySize, validateInteger } from "../codec/validate.js";
import {
  HemAbortError,
  HemDeviceError,
  type HemError,
  HemTimeoutError,
  HemUnreachableError,
  HemUnsupportedError,
} from "../errors.js";
import { parseDeviceUrl } from "./url.js";

/** The `fetch` signature the library calls: always `(url, init)`. */
export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

/** Default time limit of one device request, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

export interface TransportOptions {
  /** Device URL: `https://host[:port][/prefix]` or `http://…`. */
  url: string | URL;
  /** `fetch` used for every device request; the global one when omitted. */
  fetch?: FetchLike | undefined;
  /** Time limit per request, in milliseconds. */
  timeoutMs?: number | undefined;
}

/** Options every public call accepts. */
export interface CallOptions {
  /** Cancels the call. */
  signal?: AbortSignal | undefined;
  /** Time limit for each device request of this call, in milliseconds. */
  timeoutMs?: number | undefined;
}

/** One device request, as built by a binding. */
export interface DeviceRequest extends CallOptions {
  /** Library operation name, used in errors, e.g. `keys.list`. */
  operation: string;
  method: "GET" | "POST" | "DELETE";
  /** Path starting with `/api/`. */
  path: string;
  /** JSON-serialisable body. */
  body?: unknown;
  /** Bearer token; only for operations that need one. */
  token?: string | undefined;
}

/** A complete response: status, headers and the body read as text. */
export interface DeviceResponse {
  status: number;
  headers: Headers;
  text: string;
}

export class Transport {
  readonly baseUrl: string;
  readonly secure: boolean;
  readonly timeoutMs: number;
  readonly #fetch: FetchLike | undefined;

  constructor(options: TransportOptions) {
    const { base, secure } = parseDeviceUrl(options.url);
    this.baseUrl = base;
    this.secure = secure;
    this.timeoutMs =
      options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : validateInteger(options.timeoutMs, "timeoutMs", 1);
    if (options.fetch !== undefined && typeof options.fetch !== "function") {
      throw new HemUnsupportedError("options.fetch must be a function");
    }
    this.#fetch = options.fetch;
    if (this.#fetch === undefined && typeof globalThis.fetch !== "function") {
      throw new HemUnsupportedError("no fetch implementation: pass options.fetch or run where fetch is global");
    }
  }

  /** Sends one request and returns the complete response, whatever its status. */
  async send(req: DeviceRequest): Promise<DeviceResponse> {
    const prepared = this.prepare(req);
    return this.execute(req, prepared);
  }

  /** Validates and serialises a request; throws before anything is sent. */
  protected prepare(req: DeviceRequest): { url: string; init: RequestInit; timeoutMs: number } {
    const timeoutMs =
      req.timeoutMs === undefined ? this.timeoutMs : validateInteger(req.timeoutMs, "timeoutMs", 1);
    const headers: Record<string, string> = {};
    const init: RequestInit = { method: req.method, redirect: "manual" };
    if (req.body !== undefined) {
      const body = JSON.stringify(req.body);
      validateBodySize(body);
      headers["Content-Type"] = "application/json";
      init.body = body;
    }
    if (req.token !== undefined) headers["Authorization"] = `Bearer ${req.token}`;
    init.headers = headers;
    return { url: this.baseUrl + req.path, init, timeoutMs };
  }

  /** Runs the fetch under the time limit and the caller's signal. */
  protected async execute(
    req: DeviceRequest,
    prepared: { url: string; init: RequestInit; timeoutMs: number },
  ): Promise<DeviceResponse> {
    const { signal, operation } = req;
    if (signal?.aborted) throw abortError(operation, signal);

    const controller = new AbortController();
    let failure: HemError | undefined;
    let rejectRace: (e: HemError) => void = () => {};
    const race = new Promise<never>((_, reject) => {
      rejectRace = reject;
    });
    race.catch(() => {});
    const fail = (err: HemError) => {
      if (failure) return;
      failure = err;
      controller.abort(err);
      rejectRace(err);
    };
    const onAbort = () => fail(abortError(operation, signal));
    signal?.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(
      () => fail(new HemTimeoutError(`${operation}: no complete response within ${prepared.timeoutMs} ms`, { operation })),
      prepared.timeoutMs,
    );

    const fetchImpl: FetchLike = this.#fetch ?? ((input, init) => globalThis.fetch(input, init));
    const work = (async (): Promise<DeviceResponse> => {
      let res: Response;
      let text: string;
      try {
        res = await fetchImpl(prepared.url, { ...prepared.init, signal: controller.signal });
        text = await res.text();
      } catch (cause) {
        throw failure ?? new HemUnreachableError(`${operation}: device unreachable`, { operation, cause });
      }
      if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
        throw new HemDeviceError(`${operation}: the device answered with a redirect, which is not followed`, {
          operation,
          status: res.status,
        });
      }
      return { status: res.status, headers: res.headers, text };
    })();
    work.catch(() => {});

    try {
      return await Promise.race([work, race]);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }
}

function abortError(operation: string, signal: AbortSignal | undefined): HemAbortError {
  return new HemAbortError(`${operation}: aborted by the caller`, { operation, cause: signal?.reason });
}
