// Attended: what the Encedo broker does with an authorization request whose `iat`
// is ahead of its clock (the device RTC runs ~8 % fast). Attempt A submits the
// request as the device signs it; after a go, one check-in and attempt B. Each
// attempt that the broker accepts is one push on the phone: REJECT it. The
// person reports whether a push arrived for a refused submit.
import { expect, it } from 'vitest';
import { type HemClient, HemRelayError } from '../../src/index.js';
import { describeAttended, say, step, waitForGo } from '../support/attended-env.js';
import { deviceClient } from '../support/device-env.js';

/** Seconds the device clock is ahead of local time, from `system.status`. */
async function ahead(client: HemClient): Promise<string> {
  const status = await client.system.status();
  return ((status.time ?? Number.NaN) - Date.now() / 1000).toFixed(1);
}

/** `iat` of an authorization request (a JWS; the payload is JSON). */
function iatOf(authreq: string): number {
  const payload = JSON.parse(Buffer.from(authreq.split('.')[1] as string, 'base64url').toString()) as { iat: number };
  return payload.iat;
}

describeAttended('broker and the drifted device clock', () => {
  // verifies: REQ-AUTH-020
  it('a drifted request is refused with 401; after one check-in the broker accepts it', async () => {
    // No automatic recovery here: the point is to see the broker's own answer.
    const client = deviceClient({ clockRecovery: false });
    const relay = client.auth.approvalRelay;
    expect(relay).not.toBeNull();
    const answers: Array<{ label: string; status: number | 'accepted' }> = [];

    const attempt = async (label: string): Promise<string | null> => {
      const epk = (await relay?.getKey()) as string;
      const request = await step(label, () => client.auth.requestApproval({ epk, scope: 'keymgmt:list', note: `EHEMTEST drift ${label}: REJECT this one` }));
      say(`(${label}) authreq iat is ${(iatOf(request.authreq) - Date.now() / 1000).toFixed(1)} s ahead of local time`);
      try {
        const handle = (await relay?.submit(request)) as string;
        say(`(${label}) broker ACCEPTED the request — a push should arrive: REJECT it`);
        answers.push({ label, status: 'accepted' });
        return handle;
      } catch (error) {
        const e = error as HemRelayError;
        say(`(${label}) broker REFUSED: ${e.name} status ${e.status} body ${e.bodyText ?? JSON.stringify(e.body)} — did a push arrive anyway?`);
        expect(e).toBeInstanceOf(HemRelayError);
        answers.push({ label, status: e.status ?? 0 });
        return null;
      }
    };
    const outcome = async (label: string, handle: string | null): Promise<void> => {
      if (handle === null) return;
      for (let i = 0; i < 30; i++) {
        const result = await relay?.check(handle);
        if (result?.status !== 'pending') {
          say(`(${label}) outcome: ${result?.status}`);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 3_000));
      }
      say(`(${label}) still pending after 90 s`);
    };

    say(`device clock ahead of local by ${await ahead(client)} s`);
    await waitForGo('A', 'attempt A — request as the device signs it now; REJECT any push');
    await outcome('A', await attempt('A'));

    await waitForGo('B', 'attempt B — one check-in first, then a fresh request; REJECT any push');
    await step('B', () => client.system.checkin());
    say(`(B) after check-in: device clock ahead by ${await ahead(client)} s`);
    await outcome('B', await attempt('B'));

    say(`answers: ${answers.map((a) => `${a.label}=${a.status}`).join(', ')}`);
    expect(answers.at(-1)?.status).toBe('accepted');
  });
});
