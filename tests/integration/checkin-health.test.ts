// Live: check-in in its two device steps through the default Encedo relay and as
// the one-call convenience; the clock is set afterwards; health reports all four
// facts true. Findings go to the run log (prefix `[checkin]`).
import { expect, it } from 'vitest';
import { EncedoCheckinRelay } from '../../src/index.js';
import { describeDevice, deviceClient } from '../support/integration-env.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[checkin] ${label}: ${JSON.stringify(value)}\n`);
}

/** The claim names of a JWT-shaped token, for the record; values stay out of the log. */
function claimNames(token: string): string[] | undefined {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob((parts[1] as string).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)))) as Record<string, unknown>;
    return Object.keys(payload);
  } catch {
    return undefined;
  }
}

describeDevice('check-in and health', () => {
  // verifies: REQ-SYS-004, REQ-SYS-005, REQ-SYS-006
  it('runs check-in in two steps through the Encedo backend and leaves the clock set', async () => {
    const client = deviceClient();
    const before = await client.system.status();
    log('clock before', { clockSet: before.clockSet, ts: before.ts });

    const started = Date.now();
    const check = await client.system.getCheckin();
    expect(check.length).toBeGreaterThan(0);
    log('check token', { length: check.length, claims: claimNames(check) });

    const relayStarted = Date.now();
    const checked = await new EncedoCheckinRelay().exchange(check);
    log('backend reply', { length: checked.length, claims: claimNames(checked), ms: Date.now() - relayStarted });
    expect(checked.length).toBeGreaterThan(0);

    const result = await client.system.postCheckin(checked);
    log('postCheckin', result);
    expect(result.status).toBe('OK');

    const after = await client.system.status();
    log('clock after', { clockSet: after.clockSet, ts: after.ts, totalMs: Date.now() - started });
    expect(after.clockSet).toBe(true);
  });

  // verifies: REQ-SYS-007
  it('runs the one-call check-in, reports OK, and leaves the clock set; newcrt recorded', async () => {
    const client = deviceClient();
    const started = Date.now();
    const result = await client.system.checkin();
    log('checkin()', { ...result, ms: Date.now() - started });
    expect(result.status).toBe('OK');
    expect((await client.system.status()).clockSet).toBe(true);
  });

  // verifies: REQ-SYS-003
  it('reports a healthy device: reachable, initialised, no latched fault, clock set', async () => {
    const health = await deviceClient().system.health();
    log('health', { reachable: health.reachable, initialised: health.initialised, selfTestOk: health.selfTestOk, clockSet: health.clockSet, healthy: health.healthy });
    expect(health).toMatchObject({ reachable: true, initialised: true, selfTestOk: true, clockSet: true, healthy: true });
  });
});
