/**
 * System bindings: status and version (M1).
 *
 * @packageDocumentation
 */
import type { CallOptions } from '../transport/transport.js';
import {
  type BindingContext,
  type OperationSpec,
  invoke,
  optional,
  readBase64,
  readBoolean,
  readHex,
  readInteger,
  readNumber,
  readString,
  readStringArray,
} from './core.js';

export const SYSTEM_STATUS: OperationSpec = {
  name: 'system.status',
  group: 'system',
  method: 'GET',
  path: '/api/system/status',
  scope: null,
  tlsOnly: false,
  required: ['ctx', 'uptime', 'temp', 'fls_state'],
};

export const SYSTEM_VERSION: OperationSpec = {
  name: 'system.version',
  group: 'system',
  method: 'GET',
  path: '/api/system/version',
  scope: null,
  tlsOnly: false,
  required: ['hwv', 'fwv', 'fwk', 'fws'],
};

/** Operations of this module. */
export const SYSTEM_OPERATIONS: readonly OperationSpec[] = [SYSTEM_STATUS, SYSTEM_VERSION];

/**
 * Device status. The device leaves fields out instead of sending defaults;
 * this result states them explicitly.
 */
export interface SystemStatus {
  /** `false` only when the device is not initialised (`inited: false`). */
  readonly initialised: boolean;
  /** Whether the device clock is set (`ts` or `time` present). */
  readonly clockSet: boolean;
  /** Device time, Unix seconds; present only when the clock is set. */
  readonly time?: number;
  /** Device time as RFC 3339 UTC text; present only when the clock is set. */
  readonly ts?: string;
  /** Configured context number. */
  readonly ctx: number;
  /** Seconds since boot. */
  readonly uptime: number;
  /** Device temperature. */
  readonly temp: number;
  /** Latched self-test fault state; 0 means healthy. */
  readonly flsState: number;
  /** `false` only when the trusted-time option is off (`tts: false`). */
  readonly trustedTime: boolean;
  /** `true` right after a firmware upgrade completed. */
  readonly fwUpgrade: boolean;
  /** HTTPS server status; reported only when the request was made over plain HTTP. */
  readonly https?: boolean;
  /** Configured hostname; reported only when the request's host does not match it. */
  readonly hostname?: string;
  /** Mass-storage hardware only: per-slot `"<sectors>:rw|ro|-"` strings. */
  readonly storage?: readonly string[];
  /** Mass-storage hardware only: disk-format task progress (`"status<N>"` or `"done"`). */
  readonly format?: string;
}

/** Hardware and firmware identity. */
export interface SystemVersion {
  /** Hardware version, for example `"PPA rev 2.2"`. */
  readonly hwv: string;
  /** Firmware name from the signed image footer; compare with `HEM_API_VERSION`. */
  readonly fwv: string;
  /** Firmware public key. */
  readonly fwk: Uint8Array;
  /** Firmware signature. */
  readonly fws: Uint8Array;
  /** Bootloader name, when the device reports it. */
  readonly blv?: string;
  /** Bootloader public key, when the device reports it. */
  readonly blk?: Uint8Array;
  /** Bootloader signature, when the device reports it. */
  readonly bls?: Uint8Array;
  /** Mass-storage hardware: SD card CSD register, when the device reports it. */
  readonly sdCsd?: Uint8Array;
  /** Mass-storage hardware: SD card CID register, when the device reports it. */
  readonly sdCid?: Uint8Array;
  /** Mass-storage hardware: dashboard version hash, when the device reports it. */
  readonly uis?: Uint8Array;
}

/** Copy the defined entries of `values` into a new object. */
function defined<T extends object>(values: T): T {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T;
}

/** `client.system`: device-wide calls. */
export class SystemApi {
  readonly #context: BindingContext;

  /** @internal */
  constructor(context: BindingContext) {
    this.#context = context;
  }

  /**
   * Device status: liveness, initialisation, clock and self-test fault state.
   * Works on any device in any state.
   *
   * Device call: `GET /api/system/status`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  // implements: REQ-SYS-001
  async status(options?: CallOptions): Promise<SystemStatus> {
    const spec = SYSTEM_STATUS;
    const r = await invoke(this.#context, spec, {}, options);
    const time = optional(readInteger, spec, r, 'time');
    const ts = optional(readString, spec, r, 'ts');
    const inited = optional(readBoolean, spec, r, 'inited');
    const tts = optional(readBoolean, spec, r, 'tts');
    const fwUpgrade = optional(readBoolean, spec, r, 'fw_upgrade');
    return defined<SystemStatus>({
      initialised: inited !== false,
      clockSet: time !== undefined || ts !== undefined,
      time,
      ts,
      ctx: readInteger(spec, r, 'ctx'),
      uptime: readInteger(spec, r, 'uptime'),
      temp: readNumber(spec, r, 'temp'),
      flsState: readInteger(spec, r, 'fls_state'),
      trustedTime: tts !== false,
      fwUpgrade: fwUpgrade === true,
      https: optional(readBoolean, spec, r, 'https'),
      hostname: optional(readString, spec, r, 'hostname'),
      storage: optional(readStringArray, spec, r, 'storage'),
      format: optional(readString, spec, r, 'format'),
    } as SystemStatus);
  }

  /**
   * Hardware, firmware and bootloader identity. Compare `fwv` with
   * `HEM_API_VERSION` to check compatibility.
   *
   * Device call: `GET /api/system/version`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  // implements: REQ-SYS-002
  async version(options?: CallOptions): Promise<SystemVersion> {
    const spec = SYSTEM_VERSION;
    const r = await invoke(this.#context, spec, {}, options);
    return defined<SystemVersion>({
      hwv: readString(spec, r, 'hwv'),
      fwv: readString(spec, r, 'fwv'),
      fwk: readBase64(spec, r, 'fwk'),
      fws: readBase64(spec, r, 'fws'),
      blv: optional(readString, spec, r, 'blv'),
      blk: optional(readBase64, spec, r, 'blk'),
      bls: optional(readBase64, spec, r, 'bls'),
      sdCsd: optional(readHex, spec, r, 'sd_csd'),
      sdCid: optional(readHex, spec, r, 'sd_cid'),
      uis: optional(readBase64, spec, r, 'uis'),
    } as SystemVersion);
  }
}
