/**
 * Minimal JSON-over-fetch helper for the cloud relays. Relays use their own
 * `fetch` and never pass through the device request queue.
 *
 * @packageDocumentation
 */
import { utf8Decode } from '../codec/utf8.js';
import { HemAbortError, HemError, HemRelayError, HemTimeoutError } from '../errors.js';
import { DEFAULT_TIMEOUT_MS, type FetchFunction } from '../transport/transport.js';

/** Options of a single relay call. */
export interface RelayCallOptions {
  signal?: AbortSignal | undefined;
}

/** A relay response: status and parsed JSON body (`undefined` when empty or not JSON). */
export interface RelayResponse {
  readonly status: number;
  readonly json: unknown;
  readonly text: string;
}

/** Resolve the relay's `fetch` at call time: the configured one, else the global one. */
export function relayFetch(configured: FetchFunction | undefined, operation: string): FetchFunction {
  if (configured) return configured;
  if (typeof globalThis.fetch === 'function') return globalThis.fetch.bind(globalThis);
  throw new HemRelayError(`${operation}: no fetch implementation for the relay`, { operation });
}

/**
 * One relay request with a time limit and the caller's signal. A rejected
 * `fetch` becomes {@link HemRelayError}; the limit and the signal become
 * {@link HemTimeoutError} and {@link HemAbortError}.
 */
export async function relayRequest(
  fetchFunction: FetchFunction,
  operation: string,
  url: string,
  init: { method: 'GET' | 'POST'; body?: unknown },
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  options: RelayCallOptions = {},
): Promise<RelayResponse> {
  const { signal } = options;
  if (signal?.aborted) throw new HemAbortError(`${operation}: cancelled by the caller`, { operation, cause: signal.reason });
  const controller = new AbortController();
  let stopped: HemError | undefined;
  const stop = (error: HemError): void => {
    if (stopped) return;
    stopped = error;
    controller.abort(error);
  };
  const timer = setTimeout(() => stop(new HemTimeoutError(`${operation}: no complete response within ${timeoutMs} ms`, { operation })), timeoutMs);
  const onAbort = (): void => stop(new HemAbortError(`${operation}: cancelled by the caller`, { operation, cause: signal?.reason }));
  signal?.addEventListener('abort', onAbort, { once: true });
  const aborted = new Promise<never>((_, reject) => {
    controller.signal.addEventListener('abort', () => reject(controller.signal.reason as unknown), { once: true });
  });
  aborted.catch(() => undefined);

  try {
    const requestInit: RequestInit = { method: init.method, redirect: 'error', signal: controller.signal };
    if (init.body !== undefined) {
      requestInit.body = JSON.stringify(init.body);
      requestInit.headers = { 'Content-Type': 'application/json' };
    }
    const response = await Promise.race([fetchFunction(url, requestInit), aborted]);
    const bytes = new Uint8Array(await Promise.race([response.arrayBuffer(), aborted]));
    let text = '';
    try {
      text = utf8Decode(bytes);
    } catch {
      // Not UTF-8: no text, no JSON.
    }
    let json: unknown;
    try {
      json = text.trim() === '' ? undefined : (JSON.parse(text) as unknown);
    } catch {
      json = undefined;
    }
    return { status: response.status, json, text };
  } catch (error) {
    if (stopped) throw stopped;
    throw new HemRelayError(`${operation}: the relay could not be reached`, { operation, cause: error });
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

/** Raise {@link HemRelayError} carrying the relay's status and body. */
export function relayStatusError(operation: string, response: RelayResponse): HemRelayError {
  return new HemRelayError(`${operation}: the relay answered with HTTP ${response.status}`, {
    operation,
    status: response.status,
    ...(response.text === '' ? {} : { body: response.json ?? response.text, bodyText: response.text }),
  });
}

/** Read a required string field of a relay's JSON reply. */
export function relayString(operation: string, response: RelayResponse, field: string): string {
  const value = (response.json as Record<string, unknown> | undefined)?.[field];
  if (typeof value !== 'string') {
    throw new HemRelayError(`${operation}: the relay reply has no "${field}" string`, {
      operation,
      status: response.status,
      ...(response.text === '' ? {} : { body: response.json ?? response.text, bodyText: response.text }),
    });
  }
  return value;
}
