import { describe, expect, it } from 'vitest';
import { HemClient, HemValidationError } from '../../src/index.js';
import * as hem from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const status = { ctx: 0, uptime: 1, temp: 30, fls_state: 0 };

describe('HemClient construction', () => {
  // verifies: REQ-API-001
  it('makes no fetch call when constructed', () => {
    const fake = new FakeFetch();
    const client = new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch });
    expect(client.system).toBeDefined();
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-API-001
  it.each([undefined, '', 'ftp://my.ence.do', 'file:///etc/passwd', 'my.ence.do'])('rejects url %j with HemValidationError', (url) => {
    expect(() => new HemClient({ url, fetch: new FakeFetch().fetch } as never)).toThrow(HemValidationError);
  });

  // verifies: REQ-API-001
  it('rejects missing options with HemValidationError', () => {
    expect(() => new (HemClient as unknown as new () => HemClient)()).toThrow(HemValidationError);
  });

  // verifies: REQ-NET-002
  it('accepts the device address as a URL instance', async () => {
    const fake = new FakeFetch().on('GET', '/api/system/status', { body: status });
    await new HemClient({ url: new URL('https://my.ence.do/'), fetch: fake.fetch }).system.status();
    expect(fake.last.url.href).toBe('https://my.ence.do/api/system/status');
  });

  // verifies: REQ-API-001
  it.each([
    ['checkinRelay', {}],
    ['checkinRelay', { exchange: 'not a function' }],
    ['approvalRelay', {}],
    ['approvalRelay', { getKey: () => Promise.resolve('k'), submit: () => Promise.resolve('h') }],
    ['approvalRelay', 'relay'],
  ])('rejects a %s that lacks the interface methods with HemValidationError at construction, before any request', (parameter, relay) => {
    const fake = new FakeFetch();
    const error = (() => {
      try {
        new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, [parameter]: relay } as never);
      } catch (caught) {
        return caught;
      }
      return undefined;
    })();
    expect(error).toBeInstanceOf(HemValidationError);
    expect((error as HemValidationError).parameter).toBe(parameter);
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-API-001
  it('accepts null and complete implementations for both relays', () => {
    const fake = new FakeFetch();
    expect(() => new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, checkinRelay: null, approvalRelay: null })).not.toThrow();
    const checkinRelay = { exchange: () => Promise.resolve('checked') };
    const approvalRelay = { getKey: () => Promise.resolve('k'), submit: () => Promise.resolve('h'), check: () => Promise.resolve({ status: 'pending' as const }) };
    expect(() => new HemClient({ url: 'https://my.ence.do', fetch: fake.fetch, checkinRelay, approvalRelay })).not.toThrow();
    expect(fake.requests).toHaveLength(0);
  });

  // verifies: REQ-API-001
  it('gives two clients separate request queues', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((resolve) => (release = resolve));
    const fakeA = new FakeFetch().on('GET', '/api/system/status', async () => {
      await held;
      return { body: status };
    });
    const fakeB = new FakeFetch().on('GET', '/api/system/status', { body: status });
    const a = new HemClient({ url: 'https://hem-a.test', fetch: fakeA.fetch });
    const b = new HemClient({ url: 'https://hem-b.test', fetch: fakeB.fetch });

    const pending = a.system.status();
    await b.system.status(); // not stuck behind client a
    expect(fakeB.requests).toHaveLength(1);
    release();
    await pending;
  });

  // verifies: REQ-API-001
  it('exports no function that could change an already constructed client', () => {
    // createNodeFetch builds a new function from its arguments and keeps no state, so it cannot touch an existing client.
    const statelessFactories = ['createNodeFetch'];
    for (const [name, value] of Object.entries(hem)) {
      if (typeof value === 'function') {
        if (statelessFactories.includes(name)) continue;
        // Otherwise only classes are exported as functions.
        expect(Function.prototype.toString.call(value), name).toMatch(/^class\b/);
      } else if (typeof value === 'object' && value !== null) {
        // Constant tables are frozen.
        expect(Object.isFrozen(value), name).toBe(true);
      } else {
        expect(['string', 'number', 'boolean'], name).toContain(typeof value);
      }
    }
  });
});
