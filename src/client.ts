/**
 * The public client: one object per device.
 *
 * @packageDocumentation
 */
import { type BindingContext, noTokens } from './api/core.js';
import { SystemApi } from './api/system.js';
import { type CheckinRelay, EncedoCheckinRelay } from './relay/checkin.js';
import { type FetchFunction, Transport } from './transport/transport.js';

/** Options of {@link HemClient}. */
export interface HemClientOptions {
  /**
   * Device URL, `https:` or `http:`, with a hostname or an IP address, for
   * example `https://my.ence.do` or `https://192.168.7.1`. A path prefix is
   * kept. There is no default. Key-management and crypto operations need
   * `https:`.
   */
  url: string;
  /**
   * `fetch` used for every device request; defaults to `globalThis.fetch`.
   * TLS trust for the device certificate, proxies and test doubles are
   * configured here.
   */
  fetch?: FetchFunction | undefined;
  /** Time limit of each device request in milliseconds; default 30 000. */
  timeoutMs?: number | undefined;
  /** Minimum time between the starts of consecutive device requests, in milliseconds; default 0. */
  minIntervalMs?: number | undefined;
  /**
   * Relay for check-in (`system.checkin` and clock recovery). Default: an
   * {@link EncedoCheckinRelay} posting to `https://api.encedo.com/checkin`
   * with the global `fetch`. Pass your own implementation to route it
   * elsewhere, or `null` to disable check-in.
   */
  checkinRelay?: CheckinRelay | null | undefined;
}

/**
 * Client for one Encedo HEM device. Construction performs no I/O; all state
 * lives in the instance, and any number of clients may coexist.
 *
 * @since M1
 */
// implements: REQ-API-001
export class HemClient {
  /** Device-wide calls: status, version, health, check-in. */
  readonly system: SystemApi;

  constructor(options: HemClientOptions) {
    const transport = new Transport({
      url: options?.url,
      fetch: options?.fetch,
      timeoutMs: options?.timeoutMs,
      minIntervalMs: options?.minIntervalMs,
    });
    const context: BindingContext = { transport, tokens: noTokens };
    const checkinRelay = options.checkinRelay === undefined ? new EncedoCheckinRelay() : options.checkinRelay;
    this.system = new SystemApi(context, checkinRelay);
  }
}
