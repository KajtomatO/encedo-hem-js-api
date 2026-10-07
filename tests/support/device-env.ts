// How device tests find the device. The environment is read here, by the test
// harness only; the library reads none of it (ARCHITECTURE.md D12). The variable
// names are those of https://github.com/KajtomatO/encedo-hem-c-api, so one
// `hem.env` serves both projects:
//
//   EHEM_TEST_URL          device URL; unset → every device test is skipped
//   EHEM_TEST_PASSPHRASE   user passphrase for authenticated operations
//   EHEM_TEST_INSECURE=1   accept the device certificate without verification
//   EHEM_TEST_CACERT=FILE  verify the device certificate against this CA file
//   EHEM_TEST_PACE_MS      minimum interval between device requests; default 150
//   EHEM_ALLOW_DISRUPTIVE=1  additionally required by attended tests (attended-env.ts)
//
// This module imports nothing from vitest, so the global setup can use it too.
// implements: REQ-TEST-003 — the device is configured through the environment, or not at all.
// implements: REQ-TEST-005 — the device under test is the one the environment names; its TLS trust
//   is the caller-supplied fetch of README "Trusting the device's TLS certificate".
import { readFileSync } from 'node:fs';
import { Agent, type RequestInit as UndiciRequestInit, fetch as undiciFetch } from 'undici';
import { HemClient, type HemClientOptions } from '../../src/index.js';
import type { FetchFunction } from '../../src/transport/transport.js';

/** The default minimum interval between device requests (the C client's suite uses the same). */
export const DEFAULT_PACE_MS = 150;

/** What the environment says about the device. */
export interface DeviceEnv {
  readonly url: string;
  readonly passphrase: string | undefined;
  readonly insecure: boolean;
  readonly caCert: string | undefined;
  readonly paceMs: number;
  readonly allowDisruptive: boolean;
}

/** Parse the device variables; `undefined` when `EHEM_TEST_URL` is not set. */
export function readDeviceEnv(env: Readonly<Record<string, string | undefined>> = process.env): DeviceEnv | undefined {
  const url = env['EHEM_TEST_URL'];
  if (url === undefined || url === '') return undefined;
  const pace = env['EHEM_TEST_PACE_MS'];
  const paceMs = pace === undefined || pace === '' ? DEFAULT_PACE_MS : Number(pace);
  if (!Number.isFinite(paceMs) || paceMs < 0) throw new Error(`EHEM_TEST_PACE_MS must be a number of milliseconds, not ${JSON.stringify(pace)}`);
  return {
    url,
    passphrase: env['EHEM_TEST_PASSPHRASE'] || undefined,
    insecure: env['EHEM_TEST_INSECURE'] === '1',
    caCert: env['EHEM_TEST_CACERT'] || undefined,
    paceMs,
    allowDisruptive: env['EHEM_ALLOW_DISRUPTIVE'] === '1',
  };
}

/** The configured device, read once when the harness loads. */
export const deviceEnv: DeviceEnv | undefined = readDeviceEnv();

/** The configured device, or an error naming the variable to set. */
export function requireDevice(): DeviceEnv {
  if (deviceEnv === undefined) throw new Error('EHEM_TEST_URL is not set; use describeDevice so the test skips instead');
  return deviceEnv;
}

/** TLS options for the device connection. */
export interface DeviceTls {
  /** Name to check the certificate against, for a device addressed by IP. */
  servername?: string | undefined;
}

/**
 * A `fetch` for the device with the TLS trust the environment asks for, built
 * exactly as README "Trusting the device's TLS certificate" shows.
 */
export function deviceFetch(env: DeviceEnv, tls: DeviceTls = {}): FetchFunction {
  const connect: Record<string, unknown> = {};
  if (tls.servername !== undefined) connect['servername'] = tls.servername;
  if (env.insecure) connect['rejectUnauthorized'] = false;
  if (env.caCert !== undefined) connect['ca'] = readFileSync(env.caCert);
  const agent = new Agent({ connect });
  return (input, init) => undiciFetch(input, { ...(init as UndiciRequestInit), dispatcher: agent }) as unknown as Promise<Response>;
}

/**
 * A client for the configured device: its URL, passphrase, TLS trust and pacing
 * from the environment; `extra` overrides any option (for example `fetch` with a
 * `servername`, or `url` for the IP address).
 */
export function deviceClient(extra: Partial<HemClientOptions> = {}): HemClient {
  const env = requireDevice();
  const options: HemClientOptions = { url: env.url, fetch: deviceFetch(env), minIntervalMs: env.paceMs };
  if (env.passphrase !== undefined) options.passphrase = env.passphrase;
  return new HemClient({ ...options, ...extra });
}
