// supports: REQ-TEST-001
// Shared substitute for fetch: records every request and answers from a
// queue of scripted responses or from a handler function.

export interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | undefined;
  json: unknown;
  init: RequestInit | undefined;
  argCount: number;
}

export type Reply =
  | Response
  | Promise<Response>
  | ((req: RecordedRequest) => Response | Promise<Response>);

export interface FakeFetch {
  (input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
  readonly calls: RecordedRequest[];
  /** Queue one reply; replies are consumed in order. */
  reply(reply: Reply): FakeFetch;
  /** Answer every request not covered by the queue. */
  fallback(handler: (req: RecordedRequest) => Response | Promise<Response>): FakeFetch;
}

export function createFakeFetch(...replies: Reply[]): FakeFetch {
  const queue: Reply[] = [...replies];
  let fallbackHandler:
    | ((req: RecordedRequest) => Response | Promise<Response>)
    | undefined;
  const calls: RecordedRequest[] = [];

  const fn = async function fakeFetch(
    this: unknown,
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((value, key) => {
      headers[key] = value;
    });
    const body = typeof init?.body === "string" ? init.body : undefined;
    let json: unknown;
    if (body !== undefined) {
      try {
        json = JSON.parse(body);
      } catch {
        json = undefined;
      }
    }
    const req: RecordedRequest = {
      url: String(input),
      method: init?.method ?? "GET",
      headers,
      body,
      json,
      init,
      argCount: arguments.length,
    };
    calls.push(req);
    const next = queue.shift();
    if (next !== undefined) {
      return typeof next === "function" ? next(req) : next;
    }
    if (fallbackHandler) return fallbackHandler(req);
    throw new Error(`fake fetch: no reply scripted for ${req.method} ${req.url}`);
  } as FakeFetch;

  Object.defineProperty(fn, "calls", { value: calls });
  fn.reply = (reply: Reply) => {
    queue.push(reply);
    return fn;
  };
  fn.fallback = (handler) => {
    fallbackHandler = handler;
    return fn;
  };
  return fn;
}

/** A JSON response as the device sends it. */
export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** An error response as the device sends it: empty body, JSON content type. */
export function emptyResponse(status: number): Response {
  return new Response(status === 204 ? null : "", {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** A fetch whose promise never settles; it records the signal it was given. */
export function hangingFetch(): FakeFetch & { signals: AbortSignal[] } {
  const signals: AbortSignal[] = [];
  const fn = createFakeFetch().fallback((req) => {
    if (req.init?.signal) signals.push(req.init.signal);
    return new Promise<Response>(() => {});
  });
  return Object.assign(fn, { signals });
}
