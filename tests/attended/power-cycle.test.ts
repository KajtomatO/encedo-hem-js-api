// Attended: the client across a soft reboot and a cold boot, and with the device
// unplugged. A person reboots, unplugs and replugs the device when asked; the test
// notices from the device's status. Run by file with EHEM_ALLOW_DISRUPTIVE=1.
import { beforeAll, expect, it } from 'vitest';
import { type HemClient, HemUnreachableError } from '../../src/index.js';
import { describeAttended, say, yourTurn } from '../support/attended-env.js';
import { deviceClient } from '../support/device-env.js';
import { DeviceRecorder, describeError, probeClient, waitForDown, waitForRestart, waitForUp } from '../support/device-watch.js';

const MINUTES = 60_000;

describeAttended('power cycle and reboot', () => {
  // Built in beforeAll: a skipped describe still runs its body, and these need the device variables.
  let recorder: DeviceRecorder;
  let client: HemClient;
  let probe: HemClient;
  beforeAll(() => {
    recorder = new DeviceRecorder();
    client = deviceClient({ fetch: recorder.fetch });
    probe = probeClient();
  });

  // verifies: REQ-AUTH-008 — ARCHITECTURE.md §11 risk 4: does a soft reboot clear the clock?
  it('keeps working across a soft reboot with exactly one new login', async () => {
    say('plan: (1) soft reboot, (2) unplug + replug, (3) unplug and leave out, (4) replug. Only act on YOUR TURN.');
    await client.keys.list();
    const before = await probe.system.status();
    say(`baseline: uptime ${before.uptime} s, clock ${before.clockSet ? 'set' : 'unset'}, logins so far ${recorder.proofs}`);

    yourTurn('(1) soft reboot the device: ../encedo-hem-c-api/dev tool reboot');
    const restart = await waitForRestart(probe, 15 * MINUTES);
    say(`(1) restart seen after ${Math.round(restart.ms / 1000)} s (unreachable on the way: ${restart.sawDown}); uptime ${restart.status.uptime} s, clock ${restart.status.clockSet ? 'SET' : 'UNSET'}`);

    const proofs = recorder.proofs;
    const checkins = recorder.checkins;
    const started = Date.now();
    await client.keys.list();
    say(`(1) first call after the reboot: ok in ${Date.now() - started} ms, new logins ${recorder.proofs - proofs}, check-ins ${recorder.checkins - checkins}`);
    expect(recorder.proofs - proofs).toBe(1);
  });

  // verifies: REQ-AUTH-009
  it('keeps working after a cold boot through an automatic check-in', async () => {
    yourTurn('(2) unplug the HEM, wait about 5 seconds, plug it back in');
    const restart = await waitForRestart(probe, 15 * MINUTES);
    say(`(2) cold boot seen after ${Math.round(restart.ms / 1000)} s; uptime ${restart.status.uptime} s, clock ${restart.status.clockSet ? 'SET' : 'UNSET'}`);

    const proofs = recorder.proofs;
    const checkins = recorder.checkins;
    const started = Date.now();
    await client.keys.list();
    const after = await probe.system.status();
    say(`(2) first call after the cold boot: ok in ${Date.now() - started} ms, new logins ${recorder.proofs - proofs}, check-ins ${recorder.checkins - checkins}, clock now ${after.clockSet ? 'set' : 'unset'}`);
    if (!restart.status.clockSet) expect(recorder.checkins - checkins).toBe(1);
    expect(after.clockSet).toBe(true);
  });

  // verifies: REQ-SYS-003, REQ-NET-006
  it('reports an unplugged device as unreachable within the time limit', async () => {
    yourTurn('(3) unplug the HEM and LEAVE IT UNPLUGGED until asked');
    const down = await waitForDown(probe, 15 * MINUTES);
    say(`(3) device down; probe error: ${JSON.stringify(describeError(down))}`);

    const started = Date.now();
    const health = await deviceClient({ passphrase: undefined }).system.health();
    const healthMs = Date.now() - started;
    const statusError = await deviceClient({ passphrase: undefined }).system.status().catch((e: unknown) => e);
    say(`(3) health: reachable ${health.reachable}, healthy ${health.healthy}, ${healthMs} ms, error ${JSON.stringify(describeError(health.error))}`);
    say(`(3) status(): ${JSON.stringify(describeError(statusError))}`);
    expect(health.reachable).toBe(false);
    expect(health.healthy).toBe(false);
    expect(healthMs).toBeLessThan(31_000);
    expect(statusError).toBeInstanceOf(HemUnreachableError);

    yourTurn('(4) plug the HEM back in');
    const back = await waitForUp(probe, 15 * MINUTES);
    say(`(4) device back: uptime ${back.uptime} s, clock ${back.clockSet ? 'set' : 'unset'}. Session done.`);
  });
});
