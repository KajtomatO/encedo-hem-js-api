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
// implements: REQ-TEST-005 — the device under test is the one the environment names; custom TLS
//   trust goes through createNodeFetch, as README "Trusting the device's TLS certificate" shows.
import { readFileSync } from 'node:fs';
import { HemClient, type HemClientOptions, type NodeFetchOptions, createNodeFetch } from '../../src/index.js';
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
  /** Trust anchors (PEM) replacing both the system roots and `EHEM_TEST_CACERT`. */
  ca?: string | readonly string[] | undefined;
}

/** Whether the environment asks for trust the system does not have. */
export function customTrust(env: DeviceEnv): boolean {
  return env.insecure || env.caCert !== undefined;
}

/**
 * A `fetch` for the device with the TLS trust the environment asks for, built
 * exactly as README "Trusting the device's TLS certificate" shows.
 */
export function deviceFetch(env: DeviceEnv, tls: DeviceTls = {}): FetchFunction {
  const options: NodeFetchOptions = {};
  if (tls.servername !== undefined) options.servername = tls.servername;
  if (env.insecure) options.rejectUnauthorized = false;
  if (env.caCert !== undefined) options.ca = readFileSync(env.caCert);
  if (tls.ca !== undefined) options.ca = tls.ca;
  return createNodeFetch(options);
}

/**
 * A client for the configured device: its URL, passphrase and pacing from the
 * environment, and a `fetch` only when the environment asks for custom trust
 * — otherwise the library's default Node transport, which is what consumers
 * get. `extra` overrides any option (for example `fetch` with a `servername`,
 * or `url` for the IP address).
 */
export function deviceClient(extra: Partial<HemClientOptions> = {}): HemClient {
  const env = requireDevice();
  const options: HemClientOptions = { url: env.url, minIntervalMs: env.paceMs };
  if (customTrust(env)) options.fetch = deviceFetch(env);
  if (env.passphrase !== undefined) options.passphrase = env.passphrase;
  return new HemClient({ ...options, ...extra });
}
