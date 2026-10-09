// Live: unattended passphrase login and the session on the device — the token's
// claims and lifetime, renewal, a wrong passphrase, the role. Findings go to the
// run log (prefix `[login]`). The clock is synced first so lifetimes measure true.
import { expect, it } from 'vitest';
import { HemClient, HemUnauthenticatedError, createNodeFetch } from '../../src/index.js';
import type { FetchFunction } from '../../src/transport/transport.js';
import { describeDevice, deviceClient, requireDevice } from '../support/integration-env.js';
import { claimsOf } from '../support/login.js';

function log(label: string, value: unknown): void {
  process.stderr.write(`[login] ${label}: ${JSON.stringify(value)}\n`);
}

const nowSeconds = (): number => Math.floor(Date.now() / 1000);

/** Wraps the Node transport: times every login proof and keeps the bearer of every other request. */
class Recorder {
  readonly logins: { ms: number; status: number }[] = [];
  readonly bearers: string[] = [];
  readonly fetch: FetchFunction;

  constructor(inner: FetchFunction = createNodeFetch()) {
    this.fetch = async (input, init) => {
      const auth = (init.headers as Record<string, string> | undefined)?.['Authorization'];
      if (auth?.startsWith('Bearer ')) this.bearers.push(auth.slice('Bearer '.length));
      const isProof = init.method === 'POST' && new URL(input).pathname === '/api/auth/token';
      const started = Date.now();
      const response = await inner(input, init);
      if (isProof) this.logins.push({ ms: Date.now() - started, status: response.status });
      return response;
    };
  }

  get lastToken(): string {
    return this.bearers.at(-1) as string;
  }
}

/** Seconds a token is good for, from its claims. */
function lifetimeOf(claims: Record<string, unknown>): number {
  const exp = claims['exp'] as number;
  const iat = typeof claims['iat'] === 'number' ? claims['iat'] : nowSeconds();
  return exp - iat;
}

describeDevice('passphrase login and session', () => {
  // supports the measurements below: a synced clock (the device runs about 9 % fast, §6 quirk 17).
  it('syncs the device clock first and records the drift it found', async () => {
    const client = deviceClient();
    const before = await client.system.status();
    const driftBefore = (before.time ?? 0) - nowSeconds();
    await client.system.checkin();
    const after = await client.system.status();
    const driftAfter = (after.time ?? 0) - nowSeconds();
    log('clock drift, s', { beforeSync: driftBefore, afterSync: driftAfter, uptime: after.uptime });
    expect(Math.abs(driftAfter)).toBeLessThan(60);
  });

  // verifies: REQ-AUTH-001, REQ-AUTH-010, REQ-AUTH-006
  it('logs in unattended: the token carries sub U and the requested scope, the role is user, the default lifetime is about 8 hours', async () => {
    const recorder = new Recorder();
    const client = deviceClient({ fetch: recorder.fetch });
    const page = await client.keys.list();
    expect(page.total).toBeTypeOf('number');

    const claims = claimsOf(recorder.lastToken);
    log('token claims', { ...claims, lifetime: lifetimeOf(claims), loginMs: recorder.logins[0]?.ms });
    expect(claims['sub']).toBe('U');
    expect(claims['scope']).toBe('keymgmt:list');
    expect(client.auth.role).toEqual({ kind: 'user' });
    expect(recorder.logins).toHaveLength(1);
    expect(recorder.logins[0]?.status).toBe(200);
    expect(Math.abs(lifetimeOf(claims) - 28_800)).toBeLessThan(120);
  });

  // verifies: REQ-AUTH-006 — ARCHITECTURE.md §11 risk 8: the largest lifetime is unknown; the device's reaction is recorded.
  it('records how the device treats lifetimes above 8 hours', async () => {
    for (const seconds of [86_400, 604_800]) {
      const recorder = new Recorder();
      const client = deviceClient({ fetch: recorder.fetch, tokenLifetimeSeconds: seconds });
      const outcome = await client.keys.list().then(
        () => ({ accepted: true, issuedFor: lifetimeOf(claimsOf(recorder.lastToken)) }),
        (error: unknown) => ({ accepted: false, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) }),
      );
      log(`requested lifetime ${seconds} s`, { ...outcome, loginStatus: recorder.logins[0]?.status });
    }
  });

  // verifies: REQ-AUTH-007
  it('logs in again when a short-lived token passes its renewal margin', async () => {
    const recorder = new Recorder();
    const client = deviceClient({ fetch: recorder.fetch, tokenLifetimeSeconds: 90 });
    await client.keys.list();
    expect(recorder.logins).toHaveLength(1);
    const issued = lifetimeOf(claimsOf(recorder.lastToken));
    log('90 s token issued for, s', issued);

    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await client.keys.list();
    expect(recorder.logins).toHaveLength(1); // still within the usable 30 s

    await new Promise((resolve) => setTimeout(resolve, 31_000));
    await client.keys.list();
    log('after 36 s', { logins: recorder.logins.length });
    expect(recorder.logins).toHaveLength(2);
  }, 120_000);

  // verifies: REQ-AUTH-001
  it('rejects a wrong passphrase with HemUnauthenticatedError; the device’s delay is recorded', async () => {
    const env = requireDevice();
    const recorder = new Recorder();
    const wrong = new HemClient({ url: env.url, passphrase: 'not-the-passphrase', fetch: recorder.fetch, minIntervalMs: env.paceMs, clockRecovery: false });
    await expect(wrong.keys.list()).rejects.toThrow(HemUnauthenticatedError);
    await expect(wrong.keys.list()).rejects.toThrow(HemUnauthenticatedError);
    log('wrong passphrase, two attempts', recorder.logins);
    expect(recorder.logins.map((login) => login.status)).toEqual([401, 401]);
  });

  // verifies: REQ-AUTH-001 — ends the run with a correct login, resetting the device's failure delay.
  it('logs in correctly again afterwards', async () => {
    const recorder = new Recorder();
    await deviceClient({ fetch: recorder.fetch }).keys.list();
    log('correct login after failures', recorder.logins);
    expect(recorder.logins[0]?.status).toBe(200);
  });
});
