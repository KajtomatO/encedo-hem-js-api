/**
 * The device transport: one request in, one fully read response out, through
 * the caller's `fetch`. It knows nothing about JSON shapes, scopes or tokens.
 *
 * @packageDocumentation
 */
import { utf8Decode } from '../codec/utf8.js';
import {
  HemDeviceError,
  HemTlsRequiredError,
  HemUnsupportedError,
  HemValidationError,
  errorFromStatus,
} from '../errors.js';

/** The `fetch` signature the library calls: `(url, init)`. */
export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;

export interface TransportOptions {
  /** Device base URL, `https:` or `http:`, hostname or IP address. */
  url: string;
  /** `fetch` to use; defaults to `globalThis.fetch`. */
  fetch?: FetchFunction | undefined;
}

/** One device request. */
export interface TransportRequest {
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
export function parseDeviceUrl(url: unknown): { url: URL; prefix: string } {
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

function isRedirect(response: Response): boolean {
  return response.type === 'opaqueredirect' || (response.status >= 300 && response.status < 400);
}

/** Sends device requests for one client. */
export class Transport {
  /** Device base URL as given. */
  readonly baseUrl: URL;
  /** Path prefix in front of `/api/…`, without a trailing slash. */
  readonly #prefix: string;
  readonly #fetch: FetchFunction;

  constructor(options: TransportOptions) {
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

    const fetchFunction = this.#fetch;
    const response = await fetchFunction(this.urlFor(request.path), init);

    if (isRedirect(response)) {
      throw new HemDeviceError(`${request.operation}: the device answered with a redirect, which is not followed`, {
        operation: request.operation,
        ...(response.status === 0 ? {} : { status: response.status }),
      });
    }
    const body = new Uint8Array(await response.arrayBuffer());
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
}
