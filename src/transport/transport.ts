// Transport: one device request in, one response out, through the caller's fetch.
// implements: REQ-NET-001, REQ-NET-004, REQ-NET-005, REQ-NET-006, REQ-NET-009, REQ-NET-010, REQ-BUILD-003
// implements: REQ-NET-003, REQ-NET-007, REQ-NET-008

import { validateBodySize, validateInteger } from "../codec/validate.js";
import {
  HemAbortError,
  HemDeviceError,
  type HemError,
  HemTimeoutError,
  HemTlsRequiredError,
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
  /** Minimum interval between the starts of consecutive requests, in milliseconds (default 0). */
  minIntervalMs?: number | undefined;
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
  /** Key-management and crypto operations: refused unless the device URL is `https:`. */
  requiresTls?: boolean | undefined;
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
  readonly minIntervalMs: number;
  readonly #fetch: FetchLike | undefined;
  readonly #queue: Job[] = [];
  #busy = false;
  #lastStart = Number.NEGATIVE_INFINITY;

  constructor(options: TransportOptions) {
    const { base, secure } = parseDeviceUrl(options.url);
    this.baseUrl = base;
    this.secure = secure;
    this.timeoutMs =
      options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : validateInteger(options.timeoutMs, "timeoutMs", 1);
    if (options.fetch !== undefined && typeof options.fetch !== "function") {
      throw new HemUnsupportedError("options.fetch must be a function");
    }
    this.minIntervalMs =
      options.minIntervalMs === undefined ? 0 : validateInteger(options.minIntervalMs, "minIntervalMs", 0);
    this.#fetch = options.fetch;
    if (this.#fetch === undefined && typeof globalThis.fetch !== "function") {
      throw new HemUnsupportedError("no fetch implementation: pass options.fetch or run where fetch is global");
    }
  }

  /**
   * Sends one request and returns the complete response, whatever its status.
   * Requests of one transport are sent one at a time, in call order.
   */
  async send(req: DeviceRequest): Promise<DeviceResponse> {
    if (req.requiresTls && !this.secure) {
      throw new HemTlsRequiredError(`${req.operation}: refused over plain HTTP; the device URL must use https:`, {
        operation: req.operation,
      });
    }
    const prepared = this.prepare(req);
    const { signal } = req;
    if (signal?.aborted) throw abortError(req.operation, signal);
    return new Promise<DeviceResponse>((resolve, reject) => {
      const job: Job = { req, prepared, resolve, reject, onQueuedAbort: () => {} };
      job.onQueuedAbort = () => {
        const i = this.#queue.indexOf(job);
        if (i >= 0) {
          this.#queue.splice(i, 1);
          reject(abortError(req.operation, signal));
        }
      };
      signal?.addEventListener("abort", job.onQueuedAbort, { once: true });
      this.#queue.push(job);
      void this.#pump();
    });
  }

  async #pump(): Promise<void> {
    if (this.#busy) return;
    this.#busy = true;
    try {
      for (let job = this.#queue.shift(); job !== undefined; job = this.#queue.shift()) {
        job.req.signal?.removeEventListener("abort", job.onQueuedAbort);
        const wait = this.#lastStart + this.minIntervalMs - Date.now();
        if (wait > 0) await new Promise((r) => setTimeout(r, wait));
        this.#lastStart = Date.now();
        try {
          job.resolve(await this.execute(job.req, job.prepared));
        } catch (e) {
          job.reject(e);
        }
      }
    } finally {
      this.#busy = false;
    }
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
    const fetchImpl: FetchLike = this.#fetch ?? ((input, init) => globalThis.fetch(input, init));
    const res = await fetchWithLimit(fetchImpl, prepared.url, prepared.init, {
      operation: req.operation,
      signal: req.signal,
      timeoutMs: prepared.timeoutMs,
      what: "device",
    });
    if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
      throw new HemDeviceError(`${req.operation}: the device answered with a redirect, which is not followed`, {
        operation: req.operation,
        status: res.status,
      });
    }
    return { status: res.status, headers: res.headers, text: res.text };
  }
}

/**
 * One fetch, body included, under a time limit and an optional caller signal.
 * Fails with exactly one of HemTimeoutError, HemAbortError (whichever fires
 * first) or HemUnreachableError (fetch or body read rejected).
 */
export async function fetchWithLimit(
  fetchImpl: FetchLike,
  url: string,
  init: RequestInit,
  opts: { operation: string; signal: AbortSignal | undefined; timeoutMs: number; what: string },
): Promise<{ status: number; headers: Headers; text: string; type: ResponseType }> {
  const { signal, operation } = opts;
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
    () => fail(new HemTimeoutError(`${operation}: no complete response within ${opts.timeoutMs} ms`, { operation })),
    opts.timeoutMs,
  );

  const work = (async () => {
    try {
      const res = await fetchImpl(url, { ...init, signal: controller.signal });
      const text = await res.text();
      return { status: res.status, headers: res.headers, text, type: res.type };
    } catch (cause) {
      throw failure ?? new HemUnreachableError(`${operation}: ${opts.what} unreachable`, { operation, cause });
    }
  })();
  work.catch(() => {});

  try {
    return await Promise.race([work, race]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

interface Job {
  req: DeviceRequest;
  prepared: { url: string; init: RequestInit; timeoutMs: number };
  resolve: (res: DeviceResponse) => void;
  reject: (err: unknown) => void;
  onQueuedAbort: () => void;
}

function abortError(operation: string, signal: AbortSignal | undefined): HemAbortError {
  return new HemAbortError(`${operation}: aborted by the caller`, { operation, cause: signal?.reason });
}
