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
    for (const [name, value] of Object.entries(hem)) {
      if (typeof value === 'function') {
        // Only classes are exported as functions.
        expect(Function.prototype.toString.call(value), name).toMatch(/^class\b/);
      } else {
        expect(['string', 'number', 'boolean'], name).toContain(typeof value);
      }
    }
  });
});
