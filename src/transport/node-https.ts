/**
 * The Node.js device transport: `node:https` instead of Node's built-in
 * `fetch`. Firmware 1.2.2 matches header names case-sensitively and Node's
 * `fetch` (undici) always writes `content-length` in lowercase, so every
 * request with a body would be answered with 411 (ARCHITECTURE.md §6 quirk
 * 18). This module spells the names as the device expects and opens one
 * connection per request (quirk 19). A browser never executes it: the only
 * `node:` imports in `src/` are the dynamic ones below.
 *
 * @packageDocumentation
 */
import { HemUnsupportedError } from '../errors.js';
import type { FetchFunction } from './transport.js';

/** TLS trust of {@link createNodeFetch}; each option is passed to `node:https` as is. */
export interface NodeFetchOptions {
  /** Trust anchors in PEM, replacing the system roots — for a private or self-signed CA. */
  ca?: string | Uint8Array | readonly (string | Uint8Array)[] | undefined;
  /** Host name the certificate is checked against, for a device addressed by IP. */
  servername?: string | undefined;
  /** `false` accepts any certificate — for a laboratory only. */
  rejectUnauthorized?: boolean | undefined;
}

// The parts of node:http and node:https this module uses; typed here because the
// library build has no Node typings (tsconfig.build.json).
interface NodeResponse {
  statusCode?: number | undefined;
  headers: Record<string, string | string[] | undefined>;
  on(event: 'data', listener: (chunk: Uint8Array) => void): unknown;
  on(event: 'end', listener: () => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
}
interface NodeRequest {
  on(event: 'error', listener: (error: Error) => void): unknown;
  end(body?: Uint8Array): void;
}
interface NodeHttpModule {
  request(url: string, options: Record<string, unknown>, callback: (response: NodeResponse) => void): NodeRequest;
}

/** Whether this runtime is Node.js — the one whose `fetch` cannot drive the device. */
// implements: REQ-NET-013 — the single `process` reference in src/, allowed by REQ-BUILD-003 for this file.
export function isNode(): boolean {
  const p = (globalThis as { process?: { versions?: { node?: unknown } } }).process;
  return typeof p?.versions?.node === 'string';
}

/** The `node:http` or `node:https` module, loaded on first use. */
async function nodeModule(protocol: string): Promise<NodeHttpModule> {
  // @ts-ignore -- untyped in the library build (no Node typings there); the shape used is declared above.
  const mod = (await (protocol === 'http:' ? import('node:http') : import('node:https'))) as { default: NodeHttpModule };
  return mod.default;
}

function encodeBody(body: unknown): Uint8Array | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === 'string') return new TextEncoder().encode(body);
  if (body instanceof Uint8Array) return body;
  throw new TypeError('The Node transport sends string or Uint8Array bodies only');
}

/** The request headers as a plain record, spelled as given. */
function headerRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (headers === undefined) return {};
  if (headers instanceof Headers) {
    // Headers lowercases every name, which the device does not understand; the transport never passes one.
    const out: Record<string, string> = {};
    headers.forEach((value, name) => {
      out[name] = value;
    });
    return out;
  }
  if (Array.isArray(headers)) return Object.fromEntries(headers as [string, string][]);
  return { ...(headers as Record<string, string>) };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(chunks.reduce((n, chunk) => n + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/**
 * A response with the fields the transport reads. Not a `Response`: that
 * constructor rejects statuses outside 200–599, which the device uses (§6
 * quirk 3).
 */
function toResponse(status: number, raw: Record<string, string | string[] | undefined>, body: Uint8Array): Response {
  const headers = new Headers();
  for (const [name, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) for (const item of value) headers.append(name, item);
    else headers.set(name, value);
  }
  const bytes = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
  const like = {
    status,
    ok: status >= 200 && status < 300,
    type: 'basic',
    redirected: false,
    headers,
    arrayBuffer: () => Promise.resolve(bytes),
    text: () => Promise.resolve(new TextDecoder().decode(body)),
  };
  return like as unknown as Response;
}

/**
 * A `fetch` for the device on Node.js, built on `node:https` (or `node:http`
 * for an `http:` URL), with the TLS trust given in `options`. It is what the
 * client uses by default on Node.js; pass the result as `fetch` when the
 * device certificate needs trust the system does not have, or the device is
 * addressed by IP. Throws `HemUnsupportedError` outside Node.js.
 *
 * @since M1
 */
// implements: REQ-NET-013
export function createNodeFetch(options: NodeFetchOptions = {}): FetchFunction {
  if (!isNode()) throw new HemUnsupportedError('createNodeFetch needs Node.js; in a browser the built-in fetch is used');
  const tls: Record<string, unknown> = {};
  if (options.ca !== undefined) tls['ca'] = options.ca;
  if (options.servername !== undefined) tls['servername'] = options.servername;
  if (options.rejectUnauthorized !== undefined) tls['rejectUnauthorized'] = options.rejectUnauthorized;

  return async (input, init) => {
    const url = new URL(input);
    const mod = await nodeModule(url.protocol);
    const body = encodeBody(init.body);
    const headers = headerRecord(init.headers);
    if (body !== undefined) headers['Content-Length'] = String(body.byteLength);
    const requestOptions: Record<string, unknown> = {
      method: init.method ?? 'GET',
      headers,
      // One connection per request: the device closes the socket after every response (quirk 19).
      agent: false,
      ...tls,
    };
    if (init.signal) requestOptions['signal'] = init.signal;
    return new Promise<Response>((resolve, reject) => {
      const request = mod.request(url.href, requestOptions, (response) => {
        const chunks: Uint8Array[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', reject);
        response.on('end', () => resolve(toResponse(response.statusCode ?? 0, response.headers, concat(chunks))));
      });
      request.on('error', reject);
      request.end(body);
    });
  };
}
