// The binding pipeline, through test-only operation descriptions.
import { describe, expect, it } from 'vitest';
import { type OperationSpec, invoke, noTokens } from '../../src/api/core.js';
import { HemProtocolError, HemValidationError } from '../../src/errors.js';
import { Transport } from '../../src/transport/transport.js';
import { FakeFetch } from '../support/fake-fetch.js';

const jsonOp: OperationSpec = {
  name: 'test.json',
  group: 'system',
  method: 'POST',
  path: '/api/test/{id}',
  scope: null,
  tlsOnly: false,
  required: ['a', 'b'],
};
const emptyOp: OperationSpec = { ...jsonOp, name: 'test.empty', required: [], emptyResponse: true };

function setup(fake: FakeFetch) {
  return { transport: new Transport({ url: 'https://hem.test', fetch: fake.fetch }), tokens: noTokens };
}

describe('tolerant parsing', () => {
  // verifies: REQ-API-006
  it('accepts a response with unknown extra fields', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { body: { a: 1, b: 'two', future: { nested: true } } });
    expect(await invoke(setup(fake), jsonOp, { params: { id: 'x' } })).toEqual({ a: 1, b: 'two', future: { nested: true } });
  });

  // verifies: REQ-API-006
  it.each([
    [{ b: 1 }, 'a'],
    [{ a: 1 }, 'b'],
    [{ a: null, b: 1 }, 'a'],
  ])('raises HemProtocolError naming the missing field for %j', async (body, field) => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { body });
    const error = await invoke(setup(fake), jsonOp, { params: { id: 'x' } }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemProtocolError);
    expect((error as HemProtocolError).message).toContain(`"${field}"`);
    expect((error as HemProtocolError).operation).toBe('test.json');
  });

  // verifies: REQ-API-006
  it.each(['not json', '{"a":1,', '[1,2]', '"text"', '42', 'null'])('raises HemProtocolError for a 2xx body %j', async (text) => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { body: text, headers: { 'content-type': 'application/json' } });
    await expect(invoke(setup(fake), jsonOp, { params: { id: 'x' } })).rejects.toThrow(HemProtocolError);
  });

  // verifies: REQ-API-006
  it('raises HemProtocolError for an empty 200 where JSON is expected', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { status: 200 });
    await expect(invoke(setup(fake), jsonOp, { params: { id: 'x' } })).rejects.toThrow(HemProtocolError);
  });

  // verifies: REQ-API-006
  it('accepts an empty 200 where the success response is documented as empty', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { status: 200 }, { status: 200, headers: { 'content-type': 'application/json' } });
    expect(await invoke(setup(fake), emptyOp, { params: { id: 'x' } })).toEqual({});
    expect(await invoke(setup(fake), emptyOp, { params: { id: 'x' } })).toEqual({});
  });

  it('raises HemProtocolError for a body that is not UTF-8', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { body: Uint8Array.from([0x7b, 0xff, 0x7d]) });
    await expect(invoke(setup(fake), jsonOp, { params: { id: 'x' } })).rejects.toThrow(HemProtocolError);
  });
});

describe('request body limit', () => {
  // verifies: REQ-API-005
  it('rejects a serialised body over 7300 bytes with HemValidationError and no fetch call', async () => {
    const fake = new FakeFetch();
    const body = { msg: 'x'.repeat(7300 - 10 + 1) }; // {"msg":"…"} adds 10 bytes
    expect(JSON.stringify(body)).toHaveLength(7301);
    const error = await invoke(setup(fake), emptyOp, { params: { id: 'x' }, body }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe('body');
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-API-005
  it('sends a body of exactly 7300 bytes', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/x', { status: 200 });
    const body = { msg: 'x'.repeat(7300 - 10) };
    await invoke(setup(fake), emptyOp, { params: { id: 'x' }, body });
    expect(fake.last.body).toHaveLength(7300);
    expect(fake.last.json()).toEqual(body);
  });
});

describe('path templates', () => {
  it('URL-encodes path parameters', async () => {
    const fake = new FakeFetch().on('POST', '/api/test/a%2Fb%20c', { status: 200 });
    await invoke(setup(fake), emptyOp, { params: { id: 'a/b c' } });
    expect(fake.requests).toHaveLength(1);
  });
});
