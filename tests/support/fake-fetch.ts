// Shared fake `fetch` for unit tests: scripted responses per method and path,
// and a record of every request for assertions. No network access.
// supports: REQ-TEST-001

/** A request as the fake saw it. Header names are lowercase. */
export interface RecordedRequest {
  readonly method: string;
  readonly url: URL;
  /** `url.pathname`, for short assertions. */
  readonly path: string;
  readonly headers: Readonly<Record<string, string>>;
  /** Raw body bytes, or `undefined` when the request had no body. */
  readonly body: Uint8Array | undefined;
  /** The `redirect` mode the caller asked for. */
  readonly redirect: RequestRedirect;
  /** The `signal` passed in `init`, if any. */
  readonly signal: AbortSignal | undefined;
  /** The body decoded as UTF-8 text (`undefined` without a body). */
  text(): string | undefined;
  /** The body parsed as JSON (`undefined` without a body). */
  json(): unknown;
}

/** A canned answer. A plain object or array `body` is sent as JSON. */
export interface ReplySpec {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  /** Resolve only after this many milliseconds (still honours the signal). */
  delayMs?: number;
}

/**
 * What a route answers with:
 * - a {@link ReplySpec},
 * - a `Response`,
 * - an `Error` (the fake `fetch` rejects with it, like a network failure),
 * - `'hang'` (never settles until the request's signal aborts),
 * - a function of the request returning any of the above.
 */
export type Reply = ReplySpec | Response | Error | 'hang' | ((request: RecordedRequest) => Reply | Promise<Reply>);

interface Route {
  readonly method: string;
  readonly path: string | RegExp;
  readonly replies: Reply[];
  readonly sticky: boolean;
}

const decoder = new TextDecoder();

function abortReason(signal: AbortSignal): unknown {
  return signal.reason ?? new DOMException('This operation was aborted', 'AbortError');
}

function toResponse(spec: ReplySpec): Response {
  const status = spec.status ?? 200;
  const headers = new Headers(spec.headers);
  let body: BodyInit | null = null;
  if (spec.body instanceof Uint8Array) {
    body = spec.body as Uint8Array<ArrayBuffer>;
  } else if (typeof spec.body === 'string') {
    body = spec.body;
  } else if (spec.body !== undefined) {
    body = JSON.stringify(spec.body);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  // Statuses without a body may not carry one in a Response.
  if (status === 204 || status === 205 || status === 304) body = null;
  return new Response(body, { status, headers });
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(abortReason(signal as AbortSignal));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * A scriptable stand-in for `fetch`.
 *
 * ```ts
 * const fake = new FakeFetch().on('GET', '/api/system/version', { body: { hwv: '…' } });
 * const client = new HemClient({ url: 'https://hem.test', fetch: fake.fetch });
 * ```
 *
 * A request that matches no route rejects with an error naming it, so an
 * unscripted call fails the test.
 */
export class FakeFetch {
  /** Every request received, in order. */
  readonly requests: RecordedRequest[] = [];
  readonly #routes: Route[] = [];

  /** The function to hand to the code under test. */
  readonly fetch: typeof globalThis.fetch = (input, init) => this.#handle(input, init);

  /** Queue one-shot replies for `method` + `path`, consumed in order. */
  on(method: string, path: string | RegExp, ...replies: Reply[]): this {
    this.#routes.push({ method: method.toUpperCase(), path, replies, sticky: false });
    return this;
  }

  /** Answer every matching request with the same reply, unless a one-shot reply from `on()` matches first. */
  always(method: string, path: string | RegExp, reply: Reply): this {
    this.#routes.push({ method: method.toUpperCase(), path, replies: [reply], sticky: true });
    return this;
  }

  /** Requests whose method and path match. */
  requestsTo(method: string, path: string | RegExp): RecordedRequest[] {
    return this.requests.filter((request) => FakeFetch.#matches(request, method.toUpperCase(), path));
  }

  /** The most recent request; throws when there is none. */
  get last(): RecordedRequest {
    const request = this.requests.at(-1);
    if (!request) throw new Error('FakeFetch: no request was made');
    return request;
  }

  /** One-shot replies that were scripted but never consumed. */
  get pending(): { method: string; path: string | RegExp; count: number }[] {
    return this.#routes
      .filter((route) => !route.sticky && route.replies.length > 0)
      .map((route) => ({ method: route.method, path: route.path, count: route.replies.length }));
  }

  static #matches(request: RecordedRequest, method: string, path: string | RegExp): boolean {
    if (request.method !== method) return false;
    return typeof path === 'string' ? request.path === path : path.test(request.path + request.url.search);
  }

  async #handle(input: RequestInfo | URL, init: RequestInit | undefined): Promise<Response> {
    const request = new Request(input, init);
    const bytes = request.body ? new Uint8Array(await request.arrayBuffer()) : undefined;
    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((value, name) => {
      headers[name] = value;
    });
    const recorded: RecordedRequest = {
      method: request.method,
      url,
      path: url.pathname,
      headers,
      body: bytes,
      redirect: init?.redirect ?? request.redirect,
      signal: init?.signal ?? undefined,
      text: () => (bytes ? decoder.decode(bytes) : undefined),
      json: () => (bytes ? JSON.parse(decoder.decode(bytes)) : undefined),
    };
    this.requests.push(recorded);

    const signal = init?.signal ?? undefined;
    if (signal?.aborted) throw abortReason(signal);

    // One-shot replies take precedence over sticky ones, so `on()` can override an `always()` fallback.
    const candidates = this.#routes.filter(
      (candidate) => candidate.replies.length > 0 && FakeFetch.#matches(recorded, candidate.method, candidate.path),
    );
    const route = candidates.find((candidate) => !candidate.sticky) ?? candidates[0];
    if (!route) {
      throw new Error(`FakeFetch: unexpected request ${recorded.method} ${url.href}`);
    }
    const reply = route.sticky ? (route.replies[0] as Reply) : (route.replies.shift() as Reply);
    return this.#resolve(reply, recorded, signal);
  }

  async #resolve(reply: Reply, request: RecordedRequest, signal: AbortSignal | undefined): Promise<Response> {
    if (typeof reply === 'function') return this.#resolve(await reply(request), request, signal);
    if (reply === 'hang') {
      return new Promise<Response>((_, reject) => {
        if (signal?.aborted) reject(abortReason(signal));
        signal?.addEventListener('abort', () => reject(abortReason(signal)), { once: true });
      });
    }
    if (reply instanceof Error) throw reply;
    if (reply instanceof Response) return reply;
    if (reply.delayMs !== undefined) await sleep(reply.delayMs, signal);
    return toResponse(reply);
  }
}
