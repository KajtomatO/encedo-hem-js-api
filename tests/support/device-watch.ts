// Attended-test helpers that watch the device instead of waiting for a key press:
// a person acts (reboot, unplug, replug) and the test notices from the status call.
// supports: REQ-TEST-004
import { type FetchFunction, HemClient, type SystemStatus, createNodeFetch } from '../../src/index.js';
import { customTrust, deviceClient, deviceFetch, requireDevice } from './device-env.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A client that only asks for status, with a short time limit, no credential and no pacing. */
export function probeClient(): HemClient {
  return deviceClient({ passphrase: undefined, timeoutMs: 3_000, minIntervalMs: 0 });
}

/** The device fetch the environment asks for, wrapped to count login proofs and check-ins. */
export class DeviceRecorder {
  proofs = 0;
  checkins = 0;
  readonly fetch: FetchFunction;

  constructor() {
    const env = requireDevice();
    const inner = customTrust(env) ? deviceFetch(env) : createNodeFetch();
    this.fetch = async (input, init) => {
      const path = new URL(input).pathname;
      if (init.method === 'POST' && path === '/api/auth/token') this.proofs += 1;
      if (init.method === 'POST' && path === '/api/system/checkin') this.checkins += 1;
      return inner(input, init);
    };
  }
}

/** The status, or the error that kept it from arriving. */
async function look(probe: HemClient): Promise<SystemStatus | Error> {
  try {
    return await probe.system.status();
  } catch (error) {
    return error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Wait until the device has restarted: it answers with an uptime lower than the
 * last one seen. Returns that status and whether it was seen unreachable on the way.
 */
export async function waitForRestart(probe: HemClient, limitMs: number): Promise<{ status: SystemStatus; sawDown: boolean; ms: number }> {
  const started = Date.now();
  let last = -1;
  let sawDown = false;
  while (Date.now() - started < limitMs) {
    const seen = await look(probe);
    if (seen instanceof Error) sawDown = true;
    else {
      if (last >= 0 && seen.uptime < last) return { status: seen, sawDown, ms: Date.now() - started };
      last = seen.uptime;
    }
    await sleep(1_000);
  }
  throw new Error(`The device did not restart within ${limitMs / 1000} s`);
}

/** Wait until two status calls in a row fail. Returns the last error. */
export async function waitForDown(probe: HemClient, limitMs: number): Promise<Error> {
  const started = Date.now();
  let failures = 0;
  while (Date.now() - started < limitMs) {
    const seen = await look(probe);
    failures = seen instanceof Error ? failures + 1 : 0;
    if (failures >= 2) return seen as Error;
    await sleep(1_000);
  }
  throw new Error(`The device did not go down within ${limitMs / 1000} s`);
}

/** Wait until the device answers status again. */
export async function waitForUp(probe: HemClient, limitMs: number): Promise<SystemStatus> {
  const started = Date.now();
  while (Date.now() - started < limitMs) {
    const seen = await look(probe);
    if (!(seen instanceof Error)) return seen;
    await sleep(1_000);
  }
  throw new Error(`The device did not come back within ${limitMs / 1000} s`);
}

/** An error, its class and its root cause, for the record. */
export function describeError(error: unknown): unknown {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause as { code?: unknown; message?: unknown } | undefined;
  return { name: error.name, message: error.message, cause: cause === undefined ? undefined : { code: cause.code, message: cause.message } };
}
