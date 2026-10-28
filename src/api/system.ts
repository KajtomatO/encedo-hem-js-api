/**
 * System bindings: status, version, health and check-in (M1); config read
 * (M2).
 *
 * @packageDocumentation
 */
import { HemAbortError, HemError, HemTimeoutError, HemUnreachableError, HemUnsupportedError } from '../errors.js';
import type { CheckinRelay } from '../relay/checkin.js';
import { guardRelay, isString } from '../relay/http.js';
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

export const SYSTEM_CHECKIN_GET: OperationSpec = {
  name: 'system.getCheckin',
  group: 'system',
  method: 'GET',
  path: '/api/system/checkin',
  scope: null,
  tlsOnly: false,
  required: ['check'],
};

export const SYSTEM_CHECKIN_POST: OperationSpec = {
  name: 'system.postCheckin',
  group: 'system',
  method: 'POST',
  path: '/api/system/checkin',
  scope: null,
  tlsOnly: false,
  required: ['status'],
};

/** Operations of this module. */
export const SYSTEM_CONFIG: OperationSpec = {
  name: 'system.config',
  group: 'system',
  method: 'GET',
  path: '/api/system/config',
  scope: 'system:config',
  tlsOnly: false,
  required: [
    'iat',
    'uts',
    'devid',
    'eid',
    'eid_sign',
    'user',
    'email',
    'hostname',
    'dnsd',
    'trusted_ts',
    'trusted_backend',
    'allow_keysearch',
    'origin',
    'ctx',
    'ip',
    'http_option_hsts',
    'http_option_dosprot_mode',
    'spk',
    'nonce',
  ],
};

export const SYSTEM_OPERATIONS: readonly OperationSpec[] = [SYSTEM_STATUS, SYSTEM_VERSION, SYSTEM_CHECKIN_GET, SYSTEM_CHECKIN_POST, SYSTEM_CONFIG];

/**
 * Device configuration and identity, as read by {@link SystemApi.config}.
 * Field names follow the device's (`eid_sign` → `eidSign`); key material is
 * bytes. Fields the device sends only on some builds are optional.
 */
export interface DeviceConfig {
  /** When the configuration was created, Unix seconds (`iat`). */
  readonly createdAt: number;
  /** When the configuration was last updated, Unix seconds (`uts`). */
  readonly updatedAt: number;
  /** Device serial, 8 bytes as hexadecimal text (`devid`). */
  readonly devid: string;
  /** Device instance UUID, when the device reports one (`instanceid`). */
  readonly instanceid?: string;
  /** X25519 identity public key (`eid`). */
  readonly eid: Uint8Array;
  /** Ed25519 signing public key (`eid_sign`). */
  readonly eidSign: Uint8Array;
  /** Owner's user label. */
  readonly user: string;
  /** Owner's e-mail address. */
  readonly email: string;
  /** Configured hostname. */
  readonly hostname: string;
  /** DNS daemon option (`dnsd`). */
  readonly dnsd: boolean;
  /** Trusted-time option (`trusted_ts`); the same setting `system.status` reports as `trustedTime`. */
  readonly trustedTime: boolean;
  /** Trusted-backend option (`trusted_backend`): check-in replies may carry management actions. */
  readonly trustedBackend: boolean;
  /** Whether key search is allowed (`allow_keysearch`). */
  readonly allowKeysearch: boolean;
  /** Browser origin allow-list (`origin`), for example `*` or `https://app.example.com`. */
  readonly origin: string;
  /** Configured context number. */
  readonly ctx: number;
  /** Device address in CIDR form (`ip`), for example `192.168.7.1/24`. */
  readonly ip: string;
  /** HTTP Strict Transport Security option (`http_option_hsts`). */
  readonly hsts: boolean;
  /** Denial-of-service protection mode, 0 to 4 (`http_option_dosprot_mode`). */
  readonly dosProtectionMode: number;
  /** Mass-storage hardware: secure-element serial, when reported (`genuine_id`). */
  readonly genuineId?: string;
  /** Mass-storage hardware: storage mode, when reported (`storage_mode`). */
  readonly storageMode?: number;
  /** Mass-storage hardware: disk 0 size in sectors, when reported (`storage_disk0size`). */
  readonly storageDisk0Size?: number;
  /** Mass-storage hardware: total usable sectors, when reported (`storage_capacity`). */
  readonly storageCapacity?: number;
  /** Session X25519 public key for the user-key rotation of config write (`spk`). */
  readonly spk: Uint8Array;
  /** Fresh nonce to echo in a user-key rotation (`nonce`). */
  readonly nonce: Uint8Array;
}

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

/**
 * Result of {@link SystemApi.health}. `healthy` is true only when all four
 * facts are true.
 */
export interface HealthReport {
  /** The device answered the status request. */
  readonly reachable: boolean;
  /** The device is initialised. */
  readonly initialised: boolean;
  /** No latched self-test fault (`fls_state` is 0). */
  readonly selfTestOk: boolean;
  /** The device clock is set (login needs it). */
  readonly clockSet: boolean;
  /** All four of the above. */
  readonly healthy: boolean;
  /** The status result, when the device answered with one. */
  readonly status?: SystemStatus;
  /** Why the status could not be read, when it could not. */
  readonly error?: HemError;
}

/** Result of check-in step 2. */
export interface CheckinResult {
  /** Executed action: `OK`, `L`, `W`, `R`, `B`, `U`, or `???`. */
  readonly status: string;
  /** Result of a pushed TLS certificate install (`OK` or `ERROR`), when one was pushed. */
  readonly newcrt?: string;
  /** Newly available firmware signature, when reported. */
  readonly newfws?: string;
  /** Mass-storage hardware: newly available dashboard signature, when reported. */
  readonly newuis?: string;
}

/** Copy the defined entries of `values` into a new object. */
function defined<T extends object>(values: T): T {
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined)) as T;
}

/** `client.system`: device-wide calls. */
export interface SystemApi {
  /**
   * One-call health check for a circuit breaker: reachable, initialised, no
   * latched self-test fault, clock set. Makes exactly one request, the status
   * request. An unreachable device or an elapsed time limit is reported as
   * `reachable: false` rather than thrown; so is any other failure of the
   * status request, with `error` set. A caller abort still throws
   * `HemAbortError`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  health(options?: CallOptions): Promise<HealthReport>;

  /**
   * Check-in step 1: the device-signed check-in token (`check`), to be
   * relayed to the check-in backend unmodified.
   *
   * Device call: `GET /api/system/checkin`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  getCheckin(options?: CallOptions): Promise<string>;

  /**
   * Check-in step 2: hand the backend's reply (`checked`) to the device.
   *
   * The device validates the reply (signature, nonce, trusted issuer) and
   * sets its clock from it. When the device's trusted-backend option is on,
   * it also executes the management action the reply carries:
   * - `OK`: none;
   * - `L`: lock — erases the user key;
   * - `W`: wipes the device and reboots;
   * - `R`: report;
   * - `B`: soft-brick — stops the web servers;
   * - `U`: forces a firmware upgrade.
   *
   * With the option off, actions are suppressed. Only relay replies you
   * trust. A rejected reply (invalid, unknown nonce, untrusted issuer)
   * raises `HemUnauthenticatedError`; no login is attempted.
   *
   * Device call: `POST /api/system/checkin`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  postCheckin(checked: string, options?: CallOptions): Promise<CheckinResult>;

  /**
   * Complete check-in in one call: {@link SystemApi.getCheckin}, the client's check-in
   * relay, then {@link SystemApi.postCheckin}, each value passed on unchanged. A
   * failure's `operation` names its leg (`system.getCheckin`,
   * `relay.checkin`, `system.postCheckin`). See {@link SystemApi.postCheckin} for the
   * management actions a backend reply can trigger.
   *
   * @throws HemUnsupportedError when the client has no check-in relay.
   * @remarks Token scope: none. Introduced in M1.
   */
  checkin(options?: CallOptions): Promise<CheckinResult>;

  /**
   * Device status: liveness, initialisation, clock and self-test fault state.
   * Works on any device in any state.
   *
   * Device call: `GET /api/system/status`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  status(options?: CallOptions): Promise<SystemStatus>;

  /**
   * The device configuration and identity keys: owner, hostname and
   * address, origin allow-list, option flags, the identity and signing
   * public keys, and the session key and nonce that a configuration write
   * with user-key rotation needs. Read-only here; configuration write is a
   * later milestone.
   *
   * Device call: `GET /api/system/config`.
   *
   * @remarks Token scope: `system:config`. Introduced in M2.
   */
  config(options?: CallOptions): Promise<DeviceConfig>;

  /**
   * Hardware, firmware and bootloader identity. Compare `fwv` with
   * `HEM_API_VERSION` to check compatibility.
   *
   * Device call: `GET /api/system/version`.
   *
   * @remarks Token scope: none. Introduced in M1.
   */
  version(options?: CallOptions): Promise<SystemVersion>;
}

/** @internal Implementation of {@link SystemApi}. */
export class SystemApiImpl implements SystemApi {
  readonly #context: BindingContext;
  readonly #relay: CheckinRelay | null;

  /** @internal */
  constructor(context: BindingContext, checkinRelay: CheckinRelay | null) {
    this.#context = context;
    this.#relay = checkinRelay;
  }

  // implements: REQ-SYS-003
  async health(options?: CallOptions): Promise<HealthReport> {
    let status: SystemStatus;
    try {
      status = await this.status(options);
    } catch (error) {
      if (error instanceof HemAbortError || !(error instanceof HemError)) throw error;
      const reachable = !(error instanceof HemUnreachableError || error instanceof HemTimeoutError);
      return { reachable, initialised: false, selfTestOk: false, clockSet: false, healthy: false, error };
    }
    const selfTestOk = status.flsState === 0;
    return {
      reachable: true,
      initialised: status.initialised,
      selfTestOk,
      clockSet: status.clockSet,
      healthy: status.initialised && selfTestOk && status.clockSet,
      status,
    };
  }

  // implements: REQ-SYS-004
  async getCheckin(options?: CallOptions): Promise<string> {
    const r = await invoke(this.#context, SYSTEM_CHECKIN_GET, {}, options);
    return readString(SYSTEM_CHECKIN_GET, r, 'check');
  }

  // implements: REQ-SYS-005
  async postCheckin(checked: string, options?: CallOptions): Promise<CheckinResult> {
    const spec = SYSTEM_CHECKIN_POST;
    const r = await invoke(this.#context, spec, { body: { checked } }, options);
    return defined<CheckinResult>({
      status: readString(spec, r, 'status'),
      newcrt: optional(readString, spec, r, 'newcrt'),
      newfws: optional(readString, spec, r, 'newfws'),
      newuis: optional(readString, spec, r, 'newuis'),
    } as CheckinResult);
  }

  // implements: REQ-SYS-007
  async checkin(options?: CallOptions): Promise<CheckinResult> {
    const relay = this.#relay;
    if (!relay) throw new HemUnsupportedError('system.checkin: no check-in relay is configured', { operation: 'system.checkin' });
    const check = await this.getCheckin(options);
    const checked = await guardRelay('relay.checkin', () => relay.exchange(check, { signal: options?.signal }), isString);
    return this.postCheckin(checked, options);
  }

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

  // implements: REQ-SYS-008
  async config(options?: CallOptions): Promise<DeviceConfig> {
    const spec = SYSTEM_CONFIG;
    const r = await invoke(this.#context, spec, {}, options);
    return defined<DeviceConfig>({
      createdAt: readInteger(spec, r, 'iat'),
      updatedAt: readInteger(spec, r, 'uts'),
      devid: readString(spec, r, 'devid'),
      instanceid: optional(readString, spec, r, 'instanceid'),
      eid: readBase64(spec, r, 'eid'),
      eidSign: readBase64(spec, r, 'eid_sign'),
      user: readString(spec, r, 'user'),
      email: readString(spec, r, 'email'),
      hostname: readString(spec, r, 'hostname'),
      dnsd: readBoolean(spec, r, 'dnsd'),
      trustedTime: readBoolean(spec, r, 'trusted_ts'),
      trustedBackend: readBoolean(spec, r, 'trusted_backend'),
      allowKeysearch: readBoolean(spec, r, 'allow_keysearch'),
      origin: readString(spec, r, 'origin'),
      ctx: readInteger(spec, r, 'ctx'),
      ip: readString(spec, r, 'ip'),
      hsts: readBoolean(spec, r, 'http_option_hsts'),
      dosProtectionMode: readInteger(spec, r, 'http_option_dosprot_mode'),
      genuineId: optional(readString, spec, r, 'genuine_id'),
      storageMode: optional(readInteger, spec, r, 'storage_mode'),
      storageDisk0Size: optional(readInteger, spec, r, 'storage_disk0size'),
      storageCapacity: optional(readInteger, spec, r, 'storage_capacity'),
      spk: readBase64(spec, r, 'spk'),
      nonce: readBase64(spec, r, 'nonce'),
    } as DeviceConfig);
  }

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
