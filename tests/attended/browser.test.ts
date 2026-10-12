// Attended: the library in a real browser (headless Chromium) against the device
// and the two Encedo cloud relays, from page origins other than the device's own.
// The page is served by Playwright's request interception, so the browser sends a
// genuine cross-origin request with its real Origin header and CORS preflight;
// nothing on the device is changed. Run by file with EHEM_ALLOW_DISRUPTIVE=1 after
// `npm run build`.
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { expect, it } from 'vitest';
import { describeAttended, say } from '../support/attended-env.js';
import { requireDevice } from '../support/device-env.js';

const dist = resolve('dist');
const ORIGINS = ['https://app.example', 'http://localhost:8080'];

type Outcome = { ok: true; detail?: unknown } | { ok: false; error: unknown };

describeAttended('the library in a browser', () => {
  // verifies: REQ-NET-009, REQ-NET-011, REQ-AUTH-017, REQ-SYS-006
  it('runs from foreign page origins against the device and the cloud relays; outcomes recorded', async () => {
    const env = requireDevice();
    const browser = await chromium.launch({ headless: true });
    const results: Record<string, Record<string, Outcome>> = {};
    try {
      // Chromium's Local Network Access: a page from a non-local origin may reach a
      // private address (the device) only once the user allows it; headless denies the
      // prompt. Granting the permission is what a user clicking "Allow" does.
      for (const [origin, lna] of [...ORIGINS.map((o) => [o, true] as const), [ORIGINS[0] as string, false] as const]) {
        const label = lna ? origin : `${origin} without the local-network permission`;
        say(`browser: page at ${label} → device ${env.url}, api.encedo.com`);
        const context = await browser.newContext(lna ? { permissions: ['local-network-access'] } : {});
        const page = await context.newPage();
        await page.route(`${origin}/**`, async (route) => {
          const path = new URL(route.request().url()).pathname;
          // The page loads the built library itself and exposes it; an import() inside
          // page.evaluate would be rewritten by Vitest's transform.
          if (path === '/') {
            return route.fulfill({
              contentType: 'text/html',
              body: '<!doctype html><title>encedo-hem-js-api browser test</title><script type="module">import * as lib from "/dist/index.js"; window.hemLib = lib;</script>',
            });
          }
          return route.fulfill({ contentType: 'text/javascript', body: readFileSync(join(dist, path.replace(/^\/dist\//, ''))) });
        });
        await page.goto(`${origin}/`);
        await page.waitForFunction(() => (window as unknown as { hemLib?: unknown }).hemLib !== undefined);
        results[label] = await page.evaluate(
          async ({ url, passphrase }) => {
            const describe = (e: unknown): unknown =>
              e instanceof Error ? { name: e.name, message: e.message, status: (e as { status?: number }).status, cause: String((e as { cause?: unknown }).cause ?? '') } : String(e);
            const run = async (fn: () => Promise<unknown>): Promise<{ ok: true; detail?: unknown } | { ok: false; error: unknown }> => {
              try {
                return { ok: true, detail: await fn() };
              } catch (e) {
                return { ok: false, error: describe(e) };
              }
            };
            const lib = (window as unknown as { hemLib: typeof import('../../src/index.js') }).hemLib;
            const out: Record<string, { ok: true; detail?: unknown } | { ok: false; error: unknown }> = {};
            out['origin'] = { ok: true, detail: location.origin };
            const client = new lib.HemClient({ url, passphrase });
            out['device status (simple GET)'] = await run(async () => (await client.system.status()).initialised);
            out['device login + keys.list (preflighted)'] = await run(async () => (await client.keys.list()).total);
            out['check-in via api.encedo.com/checkin'] = await run(async () => (await client.system.checkin()).status);
            out['broker session via api.encedo.com/notify'] = await run(async () => (await new lib.EncedoApprovalRelay().getKey()).length);
            return out;
          },
          { url: env.url, passphrase: env.passphrase as string },
        );
        say(`browser results for ${label}: ${JSON.stringify(results[label])}`);
        await context.close();
      }
    } finally {
      await browser.close();
    }
    for (const origin of ORIGINS) {
      expect(results[origin]?.['device status (simple GET)']?.ok, `${origin} status`).toBe(true);
      expect(results[origin]?.['device login + keys.list (preflighted)']?.ok, `${origin} login`).toBe(true);
    }
    // Without the permission the browser refuses before anything reaches the device.
    expect(results[`${ORIGINS[0] as string} without the local-network permission`]?.['device status (simple GET)']?.ok).toBe(false);
  });
});
