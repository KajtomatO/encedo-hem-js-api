/**
 * The device transport: one request in, one fully read response out, through
 * the caller's `fetch`. It knows nothing about JSON shapes, scopes or tokens.
 *
 * @packageDocumentation
 */
import { utf8Decode } from '../codec/utf8.js';
import {
  HemAbortError,
  HemDeviceError,
  HemError,
  HemTimeoutError,
  HemTlsRequiredError,
  HemUnreachableError,
  HemUnsupportedError,
  HemValidationError,
  errorFromStatus,
} from '../errors.js';

/** Default time limit of one device request, in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Options every public call accepts. */
export interface CallOptions {
  /** Cancels the call when it fires. */
  signal?: AbortSignal | undefined;
  /**
   * Time limit in milliseconds for each device request the call makes,
   * including reading the response body. It runs from the moment a request
   * is sent, not from when the call was made: time spent waiting behind
   * other requests, and a login the call needs first, are not counted
   * against it. Defaults to the client's `timeoutMs` (30 000).
   */
  timeoutMs?: number | undefined;
}

/** The `fetch` signature the library calls: `(url, init)`. */
export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface TransportOptions {
  /** Device base URL as a string or a `URL`: `https:` or `http:`, hostname or IP address. */
  url: string | URL;
  /** `fetch` to use; defaults to `globalThis.fetch`. */
  fetch?: FetchFunction | undefined;
  /** Default time limit of each request in milliseconds (30 000). */
  timeoutMs?: number | undefined;
  /** Minimum time between the starts of consecutive requests, in milliseconds (default 0: none). */
  minIntervalMs?: number | undefined;
}

/** One device request. */
export interface TransportRequest extends CallOptions {
  /** Public operation name, used in error messages. */
  operation: string;
  method: 'GET' | 'POST' | 'DELETE';
  /** Path below the device base URL, starting with `/api/`. */
  path: string;
  /** Request body; a string is sent as `application/json`. */
  body?: string | Uint8Array | undefined;
  /** Bearer token for authenticated operations. */
  bearer?: string | undefined;
  /** Refuse to send unless the device URL is `https:` (key-management and crypto operations). */
  tlsOnly?: boolean | undefined;
  /** `Content-Disposition` of an upload. */
  contentDisposition?: string | undefined;
}

/** A completed device response with a 2xx status, body already read. */
export interface TransportResponse {
  readonly status: number;
  readonly headers: Headers;
  readonly body: Uint8Array;
  /** The body as UTF-8 text. */
  text(): string;
}

/**
 * Parse and check the device base URL. Returns the origin and the path
 * prefix without its trailing slash (empty for a bare host).
 */
// implements: REQ-NET-002
export function parseDeviceUrl(given: unknown): { url: URL; prefix: string } {
  const url = given instanceof URL ? given.href : given;
  if (typeof url !== 'string' || url === '') {
    throw new HemValidationError('Invalid url: the device URL is required', { parameter: 'url' });
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch (error) {
    throw new HemValidationError('Invalid url: not an absolute URL', { parameter: 'url', cause: error });
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HemValidationError('Invalid url: the scheme must be https: or http:', { parameter: 'url' });
  }
  if (parsed.username !== '' || parsed.password !== '') {
    throw new HemValidationError('Invalid url: credentials in the URL are not allowed', { parameter: 'url' });
  }
  if (parsed.search !== '' || parsed.hash !== '') {
    throw new HemValidationError('Invalid url: a query or fragment is not allowed', { parameter: 'url' });
  }
  return { url: parsed, prefix: parsed.pathname.replace(/\/+$/, '') };
}

/**
 * Largest delay `setTimeout` honours: 2^31 − 1 ms, about 24.8 days. Above
 * it, timers fire at once, so every millisecond option is capped here.
 */
export const MAX_TIMER_MS = 2_147_483_647;

/** Check a time limit given in the options. */
export function validateTimeout(value: unknown, parameter = 'timeoutMs'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > MAX_TIMER_MS) {
    throw new HemValidationError(`Invalid ${parameter}: must be a positive number of milliseconds up to ${MAX_TIMER_MS}`, { parameter });
  }
  return value;
}

/** Settle with `promise`, or reject with the signal's reason as soon as it aborts. */
function untilAborted<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = (): void => reject(signal.reason as unknown);
    if (signal.aborted) onAbort();
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort));
  });
}

/** Check a minimum request interval given in the options. */
export function validateInterval(value: unknown, parameter = 'minIntervalMs'): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_TIMER_MS) {
    throw new HemValidationError(`Invalid ${parameter}: must be zero or a positive number of milliseconds up to ${MAX_TIMER_MS}`, { parameter });
  }
  return value;
}

function abortError(operation: string, signal: AbortSignal): HemAbortError {
  return new HemAbortError(`${operation}: cancelled by the caller`, { operation, cause: signal.reason });
}

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

interface Waiter {
  readonly grant: () => void;
}

/**
 * Sends device requests for one client, one at a time: a request is sent
 * only after the previous one has settled and its body was read, in the
 * order the calls were made, optionally at a minimum interval.
 */
export class Transport {
  /** Device base URL as given. */
  readonly baseUrl: URL;
  /** Path prefix in front of `/api/…`, without a trailing slash. */
  readonly #prefix: string;
  readonly #fetch: FetchFunction;
  readonly #timeoutMs: number;
  readonly #minIntervalMs: number;
  // Request queue state; per instance, never module-level.
  #busy = false;
  readonly #waiters: Waiter[] = [];
  #lastStart: number | undefined;

  constructor(options: TransportOptions) {
    this.#minIntervalMs = options.minIntervalMs === undefined ? 0 : validateInterval(options.minIntervalMs);
    this.#timeoutMs = options.timeoutMs === undefined ? DEFAULT_TIMEOUT_MS : validateTimeout(options.timeoutMs);
    const { url, prefix } = parseDeviceUrl(options.url);
    this.baseUrl = url;
    this.#prefix = prefix;
    // implements: REQ-NET-001
    const fetchFunction = options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : undefined);
    if (!fetchFunction) {
      throw new HemUnsupportedError('No fetch implementation: pass one in the options, or run where globalThis.fetch exists');
    }
    this.#fetch = fetchFunction;
  }

  /** Whether the device URL uses `https:`. */
  get secure(): boolean {
    return this.baseUrl.protocol === 'https:';
  }

  /** Full URL of a device path. */
  urlFor(path: string): string {
    return `${this.baseUrl.origin}${this.#prefix}${path}`;
  }

  /**
   * Send one request and read the whole response. A 2xx response is returned;
   * any other status, and any redirect, is raised as a {@link HemError}.
   */
  async send(request: TransportRequest): Promise<TransportResponse> {
    // implements: REQ-NET-003
    if (request.tlsOnly && !this.secure) {
      throw new HemTlsRequiredError(`${request.operation}: refused to send over plain HTTP; the device URL must use https:`, {
        operation: request.operation,
      });
    }

    // implements: REQ-NET-009 — only Content-Type, Authorization and Content-Disposition, each only when needed.
    const headers: Record<string, string> = {};
    if (request.body !== undefined) {
      headers['Content-Type'] = typeof request.body === 'string' ? 'application/json' : 'application/octet-stream';
    }
    if (request.bearer !== undefined) headers['Authorization'] = `Bearer ${request.bearer}`;
    if (request.contentDisposition !== undefined) headers['Content-Disposition'] = request.contentDisposition;

    const init: RequestInit = {
      method: request.method,
      headers,
      // implements: REQ-NET-010 — a redirect is returned to us, never followed.
      redirect: 'manual',
    };
    if (request.body !== undefined) {
      init.body = typeof request.body === 'string' ? request.body : (new Uint8Array(request.body) as Uint8Array<ArrayBuffer>);
    }

    if (request.timeoutMs !== undefined) validateTimeout(request.timeoutMs);
    if (request.signal?.aborted) throw abortError(request.operation, request.signal);

    await this.#acquire(request);
    let exchanged: { response: Response; body: Uint8Array };
    try {
      await this.#pace(request);
      exchanged = await this.#exchange(request, init);
    } finally {
      this.#release();
    }
    const { response, body } = exchanged;
    if (isRedirect(response)) {
      throw new HemDeviceError(`${request.operation}: the device answered with a redirect, which is not followed`, {
        operation: request.operation,
        ...(response.status === 0 ? {} : { status: response.status }),
      });
    }
    if (response.status < 200 || response.status > 299) {
      let text = '';
      try {
        text = utf8Decode(body);
      } catch {
        // Not UTF-8: map by status alone.
      }
      throw errorFromStatus(response.status, text, request.operation);
    }
    return {
      status: response.status,
      headers: response.headers,
      body,
      text: () => utf8Decode(body),
    };
  }

  /**
   * Call fetch and read the body under the time limit and the caller's signal.
   * One internal controller is handed to fetch; whichever of the timer and
   * the caller's signal fires first aborts it and decides the error.
   */
  // implements: REQ-NET-004, REQ-NET-005, REQ-NET-006
  async #exchange(request: TransportRequest, init: RequestInit): Promise<{ response: Response; body: Uint8Array }> {
    const { operation, signal } = request;
    const limit = request.timeoutMs === undefined ? this.#timeoutMs : validateTimeout(request.timeoutMs);
    if (signal?.aborted) throw abortError(operation, signal);

    const controller = new AbortController();
    let stopped: HemError | undefined;
    const stop = (error: HemError): void => {
      if (stopped) return;
      stopped = error;
      controller.abort(error);
    };
    const timer = setTimeout(() => stop(new HemTimeoutError(`${operation}: no complete response within ${limit} ms`, { operation })), limit);
    const onAbort = (): void => stop(abortError(operation, signal as AbortSignal));
    signal?.addEventListener('abort', onAbort, { once: true });

    try {
      const fetchFunction = this.#fetch;
      // The request starts now: pacing counts from here.
      this.#lastStart = Date.now();
      const response = await untilAborted(fetchFunction(this.urlFor(request.path), { ...init, signal: controller.signal }), controller.signal);
      if (isRedirect(response)) {
        return { response, body: new Uint8Array() };
      }
      // The limit also covers the body.
      let body: Uint8Array;
      try {
        body = new Uint8Array(await untilAborted(response.arrayBuffer(), controller.signal));
      } catch (error) {
        // An error status whose body cannot be read (the device closes the
        // connection after a 413) is still mapped by its status, with an empty body.
        if (stopped || response.ok) throw error;
        body = new Uint8Array();
      }
      return { response, body };
    } catch (error) {
      if (stopped) throw stopped;
      throw new HemUnreachableError(`${operation}: the device could not be reached`, { operation, cause: error });
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  /**
   * Wait for this client's turn. A waiting call whose signal fires leaves the
   * queue and is never sent.
   */
  // implements: REQ-NET-007, REQ-NET-005
  #acquire(request: TransportRequest): Promise<void> {
    if (!this.#busy) {
      this.#busy = true;
      return Promise.resolve();
    }
    const { signal, operation } = request;
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        const index = this.#waiters.indexOf(waiter);
        if (index >= 0) this.#waiters.splice(index, 1);
        reject(abortError(operation, signal as AbortSignal));
      };
      const waiter: Waiter = {
        grant: () => {
          signal?.removeEventListener('abort', onAbort);
          resolve();
        },
      };
      this.#waiters.push(waiter);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  /** Hand the turn to the next waiting call, or mark the client idle. */
  #release(): void {
    const next = this.#waiters.shift();
    if (next) next.grant();
    else this.#busy = false;
  }

  /** Keep the minimum interval since the previous request started. With an interval of 0 no timer is used. */
  // implements: REQ-NET-008
  async #pace(request: TransportRequest): Promise<void> {
    if (this.#minIntervalMs > 0 && this.#lastStart !== undefined) {
      // Loop: a timer may fire a millisecond early by the wall clock.
      for (let wait = this.#lastStart + this.#minIntervalMs - Date.now(); wait > 0; wait = this.#lastStart + this.#minIntervalMs - Date.now()) {
        await this.#sleep(wait, request);
      }
    }
  }

  #sleep(ms: number, { signal, operation }: TransportRequest): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const onAbort = (): void => {
        clearTimeout(timer);
        reject(abortError(operation, signal as AbortSignal));
      };
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, ms);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }
}
