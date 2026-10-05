import { describe, expect, it } from 'vitest';
import { EncedoApprovalRelay, HemClient, HemRelayError } from '../../src/index.js';
import { FakeFetch } from '../support/fake-fetch.js';

const EPK = 'AQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQE=';
const relayWith = (cloud: FakeFetch, url?: string): EncedoApprovalRelay => new EncedoApprovalRelay({ fetch: cloud.fetch, url });

describe('EncedoApprovalRelay', () => {
  // verifies: REQ-AUTH-017
  it('getKey: GET /session returns epk', async () => {
    const cloud = new FakeFetch().on('GET', '/notify/session', { body: { epk: EPK, exp: 1800000000 } });
    expect(await relayWith(cloud).getKey()).toBe(EPK);
    expect(cloud.last.url.href).toBe('https://api.encedo.com/notify/session');
    expect(cloud.last.headers).toEqual({});
  });

  // verifies: REQ-AUTH-017
  it('submit: POST /event/new with {authreq, epk} returns the eventid', async () => {
    const cloud = new FakeFetch().on('POST', '/notify/event/new', { body: { eventid: 'ev-1', other: 2 } });
    expect(await relayWith(cloud).submit({ authreq: 'areq', epk: EPK })).toBe('ev-1');
    expect(cloud.last.url.href).toBe('https://api.encedo.com/notify/event/new');
    expect(cloud.last.headers).toEqual({ 'content-type': 'application/json' });
    expect(cloud.last.json()).toEqual({ authreq: 'areq', epk: EPK });
  });

  // verifies: REQ-AUTH-017
  it('check: GET /event/check/<eventid> maps 202, deny, authreply and 404', async () => {
    const cloud = new FakeFetch().on(
      'GET',
      '/notify/event/check/ev-1',
      { status: 202 },
      { status: 200, body: { deny: true } },
      { status: 200, body: { authreply: 'the.reply.jws', from: 'phone' } },
      { status: 404 },
    );
    const relay = relayWith(cloud);
    expect(await relay.check('ev-1')).toEqual({ status: 'pending' });
    expect(await relay.check('ev-1')).toEqual({ status: 'rejected' });
    expect(await relay.check('ev-1')).toEqual({ status: 'approved', authreply: 'the.reply.jws' });
    expect(await relay.check('ev-1')).toEqual({ status: 'expired' });
    expect(cloud.requests.every((r) => r.url.href === 'https://api.encedo.com/notify/event/check/ev-1')).toBe(true);
  });

  // verifies: REQ-AUTH-017
  it.each([
    ['GET', '/notify/session', (r: EncedoApprovalRelay) => r.getKey(), 500],
    ['POST', '/notify/event/new', (r: EncedoApprovalRelay) => r.submit({ authreq: 'a', epk: EPK }), 401],
    ['GET', '/notify/event/check/x', (r: EncedoApprovalRelay) => r.check('x'), 500],
    ['GET', '/notify/event/check/x', (r: EncedoApprovalRelay) => r.check('x'), 403],
  ] as const)('raises HemRelayError carrying status and body for %s %s answering %i', async (method, path, run, status) => {
    const cloud = new FakeFetch().on(method, path, { status, body: { error: 'nope' } });
    const error = await run(relayWith(cloud)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HemRelayError);
    expect((error as HemRelayError).status).toBe(status);
    expect((error as HemRelayError).body).toEqual({ error: 'nope' });
  });

  it('raises HemRelayError for a 200 check reply that is neither deny nor authreply', async () => {
    const cloud = new FakeFetch().on('GET', '/notify/event/check/x', { body: { something: 'else' } });
    await expect(relayWith(cloud).check('x')).rejects.toThrow(HemRelayError);
  });

  // verifies: REQ-AUTH-017
  it('takes a configurable base URL and URL-encodes the event id', async () => {
    const cloud = new FakeFetch().on('GET', '/broker/event/check/a%2Fb', { status: 202 });
    await relayWith(cloud, 'https://relay.example/broker/').check('a/b');
    expect(cloud.last.url.href).toBe('https://relay.example/broker/event/check/a%2Fb');
  });

  // verifies: REQ-AUTH-017
  it('never uses the device fetch', async () => {
    const device = new FakeFetch();
    const cloud = new FakeFetch().on('GET', '/notify/session', { body: { epk: EPK } });
    const relay = relayWith(cloud);
    new HemClient({ url: 'https://my.ence.do', fetch: device.fetch, approvalRelay: relay });
    await relay.getKey();
    expect(device.requests).toHaveLength(0);
    expect(cloud.requests).toHaveLength(1);
  });

  it('uses the global fetch when none is given', async () => {
    const cloud = new FakeFetch().on('GET', '/notify/session', { body: { epk: EPK } });
    const original = globalThis.fetch;
    globalThis.fetch = cloud.fetch;
    try {
      expect(await new EncedoApprovalRelay().getKey()).toBe(EPK);
    } finally {
      globalThis.fetch = original;
    }
  });
});
