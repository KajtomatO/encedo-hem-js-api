// Live: 401, 403 and 406 provoked on the device, their error classes, and the
// raw bodies of the error responses. Findings go to the run log (prefix `[errors]`).
import { afterAll, beforeAll, expect, it } from 'vitest';
import { HemClient, HemForbiddenError, HemOperationFailedError, HemUnauthenticatedError, createNodeFetch } from '../../src/index.js';
import { contextOf } from '../../src/client.js';
import type { FetchFunction, TransportRequest } from '../../src/transport/transport.js';
import { describeDevice, deviceClient, requireDevice } from '../support/integration-env.js';
import { TestKeys } from '../support/test-keys.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[errors] ${label}: ${JSON.stringify(value)}\n`);
}

/** Keeps the status and the raw body length of every response that is not 2xx. */
class ErrorBodies {
  readonly seen: { path: string; status: number; bodyBytes: number; contentType: string | null }[] = [];
  readonly fetch: FetchFunction;

  constructor(inner: FetchFunction = createNodeFetch()) {
    this.fetch = async (input, init) => {
      const response = await inner(input, init);
      if (response.status < 200 || response.status > 299) {
        const body = new Uint8Array(await response.clone().arrayBuffer());
        this.seen.push({ path: new URL(input).pathname, status: response.status, bodyBytes: body.length, contentType: response.headers.get('content-type') });
      }
      return response;
    };
  }
}

const describeError = (error: unknown): unknown =>
  error instanceof Error ? { name: error.name, status: (error as { status?: number }).status, bodyText: (error as { bodyText?: string }).bodyText ?? null } : String(error);

describeDevice('error mapping on the device', () => {
  let bodies: ErrorBodies;
  let client: HemClient;
  let keys: TestKeys;
  let kid: string;

  beforeAll(async () => {
    bodies = new ErrorBodies();
    client = deviceClient({ fetch: bodies.fetch });
    keys = new TestKeys(client);
    kid = await keys.create({ type: 'SHA2-256' });
  }, 120_000);

  afterAll(async () => {
    await keys?.cleanup();
    log('error responses seen', bodies.seen);
    // verifies: REQ-API-003 — every error response from the device had an empty body.
    expect(bodies.seen.length).toBeGreaterThanOrEqual(4);
    expect(bodies.seen.filter((r) => r.bodyBytes !== 0)).toEqual([]);
  }, 120_000);

  // verifies: REQ-API-002, REQ-API-003
  it('maps 401 to HemUnauthenticatedError: a wrong passphrase, and a present but invalid bearer', async () => {
    const env = requireDevice();
    const wrong = new HemClient({ url: env.url, passphrase: 'not-the-passphrase', fetch: bodies.fetch, minIntervalMs: env.paceMs, clockRecovery: false });
    const login = await wrong.keys.list().catch((e: unknown) => e);
    log('wrong passphrase', describeError(login));
    expect(login).toBeInstanceOf(HemUnauthenticatedError);
    expect((login as HemUnauthenticatedError).status).toBe(401);

    const request: TransportRequest = { operation: 'test.list', method: 'GET', path: '/api/keymgmt/list', bearer: 'not.a.token', tlsOnly: true };
    const bearer = await contextOf(client).transport.send(request).catch((e: unknown) => e);
    log('invalid bearer', describeError(bearer));
    expect(bearer).toBeInstanceOf(HemUnauthenticatedError);
  });

  // verifies: REQ-API-002, REQ-API-003
  it('maps 403 to HemForbiddenError: a crypto call with a token of another scope', async () => {
    const context = contextOf(client);
    const error = await context.tokens
      .withToken('keymgmt:list', {}, (token) =>
        context.transport.send({
          operation: 'test.hmac',
          method: 'POST',
          path: '/api/crypto/hmac/hash',
          body: JSON.stringify({ kid, msg: 'AQID' }),
          bearer: token,
          tlsOnly: true,
        }),
      )
      .catch((e: unknown) => e);
    log('hmac with a keymgmt:list token', describeError(error));
    expect(error).toBeInstanceOf(HemForbiddenError);
    expect((error as HemForbiddenError).status).toBe(403);
  });

  // verifies: REQ-API-002, REQ-API-003
  it('maps 406 to HemOperationFailedError: get and delete of a key that does not exist', async () => {
    const missing = 'ffffffffffffffffffffffffffffffff';
    const get = await client.keys.get(missing).catch((e: unknown) => e);
    const del = await client.keys.delete(missing).catch((e: unknown) => e);
    log('missing key', { get: describeError(get), delete: describeError(del) });
    expect(get).toBeInstanceOf(HemOperationFailedError);
    expect(del).toBeInstanceOf(HemOperationFailedError);
  });
});
