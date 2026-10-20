// Attended: mobile approval with the real Encedo app on the paired phone. Five
// pushes; each note says what to do: approve, reject, ignore, approve, approve.
// No push is sent before the person has said go for it (waitForGo). Run by file
// with EHEM_ALLOW_DISRUPTIVE=1; the person is guided from tmp/attended.log.
import { afterAll, beforeAll, expect, it } from 'vitest';
import { type HemClient, HemApprovalRejectedError, HemApprovalTimeoutError, createNodeFetch } from '../../src/index.js';
import type { FetchFunction } from '../../src/transport/transport.js';
import { describeAttended, say, step, waitForGo } from '../support/attended-env.js';
import { customTrust, deviceClient, deviceFetch, requireDevice } from '../support/device-env.js';
import { claimsOf } from '../support/login.js';
import { TestKeys } from '../support/test-keys.js';

const MINUTE = 60_000;

/** Counts the approval requests (one push each) and check-ins the client sends to the device. */
class PushCounter {
  pushes = 0;
  checkins = 0;
  readonly fetch: FetchFunction;
  constructor() {
    const env = requireDevice();
    const inner = customTrust(env) ? deviceFetch(env) : createNodeFetch();
    this.fetch = async (input, init) => {
      const path = new URL(input).pathname;
      if (init.method === 'POST' && path === '/api/auth/ext/request') this.pushes += 1;
      if (init.method === 'POST' && path === '/api/system/checkin') this.checkins += 1;
      return inner(input, init);
    };
  }
}

/** Seconds until expiry, from whatever an approval resolved with (a token today, a session description later). */
function secondsLeft(result: unknown): number | undefined {
  const now = Date.now() / 1000;
  if (typeof result === 'string') return Math.round((claimsOf(result)['exp'] as number) - now);
  const expiresAt = (result as { expiresAt?: number } | undefined)?.expiresAt;
  return expiresAt === undefined ? undefined : Math.round(expiresAt - now);
}

describeAttended('mobile approval on the paired phone', () => {
  let counter: PushCounter;
  let client: HemClient;

  beforeAll(() => {
    counter = new PushCounter();
    // No passphrase: every token this client holds came through the phone.
    client = deviceClient({ passphrase: undefined, fetch: counter.fetch });
    say('plan: 5 pushes on the phone — (1) APPROVE, (2) REJECT, (3) IGNORE, (4) APPROVE, (5) APPROVE. Each waits for go.');
  });

  // verifies: REQ-AUTH-014
  it('gets an authorization request from the device for keymgmt:list (no push)', async () => {
    const relay = client.auth.approvalRelay;
    expect(relay).not.toBeNull();
    const epk = await relay?.getKey();
    const request = await client.auth.requestApproval({ epk: epk as string, scope: 'keymgmt:list' });
    say(`(0) authorization request: authreq ${request.authreq.length} characters, epk echoed ${request.epk === epk}`);
    expect(request.authreq.split('.')).toHaveLength(3);
  });

  // verifies: REQ-AUTH-017, REQ-AUTH-015, REQ-AUTH-018
  it('push 1 — approved: the broker reports pending then approved, and the token works on the device', async () => {
    await waitForGo('1', 'push 1 — you will APPROVE it');
    const pending = await step('1', () => client.auth.beginApproval('keymgmt:list', { note: 'EHEMTEST (1): APPROVE this one' }));
    say('(1) push sent — APPROVE it now');
    const started = Date.now();
    let pendingPolls = 0;
    let outcome: unknown;
    while (Date.now() - started < 3 * MINUTE) {
      const poll = await step('1', () => client.auth.pollApproval(pending));
      if (poll.status !== 'pending') {
        outcome = poll;
        break;
      }
      pendingPolls += 1;
      await new Promise((resolve) => setTimeout(resolve, 3_000));
    }
    const approved = outcome as { status: string; token?: string; session?: unknown } | undefined;
    const left = secondsLeft(approved?.token ?? approved?.session);
    say(`(1) broker: ${pendingPolls} pending poll(s), then ${approved?.status ?? 'no answer'} after ${Math.round((Date.now() - started) / 1000)} s; token good for ${left} s`);
    expect(approved?.status).toBe('approved');

    const page = await step('1', () => client.keys.list());
    say(`(1) keys.list with the approved token: ok, ${page.total} keys; role ${JSON.stringify(client.auth.role)}`);
    expect(page.total).toBeGreaterThan(0);
  });

  // The Encedo app accepts only the scopes it knows: a push for `keymgmt:search` is shown as
  // "Unknown scope" and can be neither approved nor rejected (observed 2026-10-20), so pushes
  // 2 and 3 ask for `keymgmt:list`. `approve` always sends a new request; the cached token
  // from push 1 plays no part.
  // verifies: REQ-AUTH-018
  it('push 2 — rejected: HemApprovalRejectedError', async () => {
    await waitForGo('2', 'push 2 — you will REJECT it');
    say('(2) push being sent — REJECT it');
    const error = await client.auth.approve('keymgmt:list', { note: 'EHEMTEST (2): REJECT this one' }, { timeoutMs: 3 * MINUTE }).catch((e: unknown) => e);
    say(`(2) outcome: ${error instanceof Error ? `${error.name}: ${error.message}` : 'approved (unexpected)'}`);
    expect(error).toBeInstanceOf(HemApprovalRejectedError);
  });

  // verifies: REQ-AUTH-018
  it('push 3 — ignored: HemApprovalTimeoutError', async () => {
    await waitForGo('3', 'push 3 — you will IGNORE it (do not touch it for about 60 s)');
    say('(3) push being sent — IGNORE it');
    const started = Date.now();
    const error = await client.auth.approve('keymgmt:list', { note: 'EHEMTEST (3): IGNORE this one' }, { timeoutMs: MINUTE }).catch((e: unknown) => e);
    say(`(3) outcome after ${Math.round((Date.now() - started) / 1000)} s: ${error instanceof Error ? `${error.name}: ${error.message}` : 'approved (unexpected)'}`);
    expect(error).toBeInstanceOf(HemApprovalTimeoutError);
  });

  // verifies: REQ-AUTH-019, REQ-AUTH-020
  it('pushes 4 and 5 — mobile login mode: an HMAC on each of two keys, one push per key', async () => {
    const keys = new TestKeys(deviceClient()); // created with the passphrase, so no push
    try {
      const k1 = await keys.create({ type: 'SHA2-256' });
      const k2 = await keys.create({ type: 'SHA2-256' });
      const mobileCounter = new PushCounter();
      const mobile = deviceClient({ passphrase: undefined, fetch: mobileCounter.fetch, mobileApproval: { note: 'EHEMTEST (4/5): APPROVE', timeoutMs: 3 * MINUTE } });
      const msg = Uint8Array.from([1, 2, 3]);

      await waitForGo('4', 'push 4 — you will APPROVE it (HMAC with key 1)');
      say('(4) push being sent — APPROVE it');
      const mac1 = await step('4', () => mobile.crypto.hmac({ kid: k1, msg }));
      say(`(4) HMAC with key 1: ${mac1.length} bytes after approval; pushes so far ${mobileCounter.pushes}`);

      await waitForGo('5', 'push 5 — you will APPROVE it (HMAC with key 2)');
      say('(5) push being sent — APPROVE it');
      const mac2 = await step('5', () => mobile.crypto.hmac({ kid: k2, msg }));
      const afterTwoKeys = mobileCounter.pushes;
      await mobile.crypto.hmac({ kid: k1, msg }); // cached token for key 1: no push
      // One approval per key, plus one resubmit per key when the broker refused the first
      // request for clock drift (REQ-AUTH-020); the exact count is a finding, not a rule.
      say(`(5) HMAC with key 2: ${mac2.length} bytes; requests for two keys: ${afterTwoKeys} (approvals plus drift resubmits); drift check-ins: ${mobileCounter.checkins}; third call added ${mobileCounter.pushes - afterTwoKeys}`);
      expect(mac1).toHaveLength(32);
      expect(mac2).toHaveLength(32);
      expect(afterTwoKeys).toBeGreaterThanOrEqual(2);
      expect(mobileCounter.pushes).toBe(afterTwoKeys);
    } finally {
      await keys.cleanup();
    }
  });

  afterAll(() => {
    say(`session done; pushes by the first client: ${counter?.pushes}, check-ins: ${counter?.checkins}`);
  });
});
