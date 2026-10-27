// Attended: how the device takes requests in parallel (ARCHITECTURE.md §11 Q5,
// risks 3 and 6). The library itself never sends two at once (REQ-NET-007), so
// this goes around it. The device may stall; a person stands by to power-cycle it.
import { expect, it } from 'vitest';
import { createNodeFetch } from '../../src/index.js';
import { describeAttended, say } from '../support/attended-env.js';
import { deviceClient, requireDevice } from '../support/device-env.js';
import { describeError, probeClient, waitForUp } from '../support/device-watch.js';

describeAttended('parallel requests', () => {
  // verifies: REQ-NET-007
  it('records how the device answers two and four requests at once', async () => {
    const env = requireDevice();
    say('parallel probe: stand by; if the device stops answering, unplug and replug it');
    const fetch = createNodeFetch();
    const status = async (): Promise<string> => {
      const started = Date.now();
      try {
        const response = await fetch(`${env.url}/api/system/status`, { method: 'GET', signal: AbortSignal.timeout(15_000) });
        await response.arrayBuffer();
        return `${response.status} in ${Date.now() - started} ms`;
      } catch (error) {
        return `failed after ${Date.now() - started} ms: ${JSON.stringify(describeError(error))}`;
      }
    };

    const results: Record<string, string[][]> = { 'two at once': [], 'four at once': [] };
    for (let round = 0; round < 5; round += 1) results['two at once']?.push(await Promise.all([status(), status()]));
    for (let round = 0; round < 2; round += 1) results['four at once']?.push(await Promise.all([status(), status(), status(), status()]));
    say(`raw status in parallel: ${JSON.stringify(results)}`);

    // Two clients, each serialised on its own, logged in, listing at the same time.
    const a = deviceClient();
    const b = deviceClient();
    await a.keys.list();
    await b.keys.list();
    const both: string[] = [];
    for (let round = 0; round < 3; round += 1) {
      const outcome = await Promise.allSettled([a.keys.list(), b.keys.list()]);
      both.push(outcome.map((o) => (o.status === 'fulfilled' ? 'ok' : JSON.stringify(describeError(o.reason)))).join(' | '));
    }
    say(`two clients listing at once: ${JSON.stringify(both)}`);

    const after = await waitForUp(probeClient(), 5 * 60_000);
    say(`device after the probe: uptime ${after.uptime} s — still answering`);
    expect(after.initialised).toBe(true);
  });
});
