// Bindings of the system group.
// implements: REQ-SYS-001, REQ-SYS-002, REQ-SYS-003, REQ-SYS-004, REQ-SYS-005, REQ-SYS-007

import { HemAbortError, HemError, HemTimeoutError, HemUnreachableError, HemValidationError } from "../errors.js";
import { callOptions, sendPublic, type ClientContext } from "../internal/context.js";
import {
  optBoolean,
  optBytes,
  optNumber,
  optString,
  parseObject,
  reqBytes,
  reqNumber,
  reqString,
  type JsonObject,
} from "../internal/parse.js";
import type { CallOptions } from "../transport/transport.js";
import { getCheckin, postCheckin, runCheckin, type CheckinResult } from "./checkin.js";

/**
 * Device status. The device omits fields instead of sending defaults; they
 * are turned into explicit values here.
 */
export interface SystemStatus {
  /** False only when the device reports `inited: false`. */
  readonly initialised: boolean;
  /** True exactly when the device sends its time (`ts` or `time`). */
  readonly clockSet: boolean;
  /** Device time, Unix seconds, when the clock is set. */
  readonly time: number | undefined;
  /** Device time, RFC 3339, when the clock is set. */
  readonly ts: string | undefined;
  /** Configured context number. */
  readonly ctx: number;
  /** Seconds since boot. */
  readonly uptime: number;
  /** Device temperature. */
  readonly temp: number;
  /** Latched self-test fault state; 0 means healthy. */
  readonly flsState: number;
  /** HTTPS server status; reported only on plain-HTTP requests. */
  readonly https: boolean | undefined;
  /** Configured hostname; reported only when the request's host does not match it. */
  readonly hostname: string | undefined;
  /** False only when the device reports the trusted-time option as off (`tts: false`). */
  readonly trustedTime: boolean;
  /** True right after a firmware upgrade completed. */
  readonly fwUpgrade: boolean;
  /** Mass-storage hardware only: per-slot `<sectors>:rw|ro|-` strings. */
  readonly storage: readonly string[] | undefined;
  /** Mass-storage hardware only: disk-format progress. */
  readonly format: string | undefined;
}

/** Hardware, firmware and bootloader identity. */
export interface SystemVersion {
  /** Hardware version, e.g. `PPA rev 2.2`. */
  readonly hwv: string;
  /** Firmware name; compare with `HEM_API_VERSION`. */
  readonly fwv: string;
  /** Firmware public key. */
  readonly fwk: Uint8Array;
  /** Firmware signature. */
  readonly fws: Uint8Array;
  /** Bootloader name, when reported. */
  readonly blv: string | undefined;
  /** Bootloader public key, when reported. */
  readonly blk: Uint8Array | undefined;
  /** Bootloader signature, when reported. */
  readonly bls: Uint8Array | undefined;
  /** Mass-storage hardware: SD CSD register (hex), when reported. */
  readonly sdCsd: string | undefined;
  /** Mass-storage hardware: SD CID register (hex), when reported. */
  readonly sdCid: string | undefined;
  /** Mass-storage hardware: dashboard version hash, when reported. */
  readonly uis: Uint8Array | undefined;
}

/** What a circuit breaker needs to know, from one status request. */
export interface HealthReport {
  /** A complete status response arrived within the time limit. */
  readonly reachable: boolean;
  /** The device is initialised. */
  readonly initialised: boolean;
  /** No self-test fault is latched (`fls_state` is 0). */
  readonly selfTestOk: boolean;
  /** The device clock is set (login fails with 403 until it is). */
  readonly clockSet: boolean;
  /** All four facts above are true. */
  readonly healthy: boolean;
  /** The status, when the device was reachable. */
  readonly status: SystemStatus | undefined;
  /** Why the device counts as unreachable (`HemUnreachableError` or `HemTimeoutError`). */
  readonly error: HemError | undefined;
}

/** `client.system`: device status, version, health and check-in. */
export interface SystemApi {
  /**
   * Reads the device status (`GET /api/system/status`). Works in any device
   * state and never sends a token.
   *
   * @scope none
   * @milestone M1
   */
  status(options?: CallOptions): Promise<SystemStatus>;

  /**
   * Reads the hardware and firmware identity (`GET /api/system/version`).
   *
   * @scope none
   * @milestone M1
   */
  version(options?: CallOptions): Promise<SystemVersion>;

  /**
   * Reports whether the device is reachable, initialised, free of a latched
   * self-test fault and has its clock set, from exactly one status request.
   * An unreachable device or an elapsed time limit is a result
   * (`reachable: false`), not an error; a caller abort still raises
   * `HemAbortError`, and other errors (for example a 412 origin rejection)
   * are raised.
   *
   * @scope none
   * @milestone M1
   */
  health(options?: CallOptions): Promise<HealthReport>;

  /**
   * Check-in step 1 (`GET /api/system/checkin`): returns the device-signed
   * `check` token, unmodified, for the check-in backend.
   *
   * @scope none
   * @milestone M1
   */
  getCheckin(options?: CallOptions): Promise<string>;

  /**
   * Check-in step 2 (`POST /api/system/checkin`): hands the backend's
   * `checked` reply to the device, unmodified. The device validates it and
   * sets its clock from it. When the device's trusted-backend option is on,
   * it also executes the management action the reply carries: `L` erases the
   * user key, `W` wipes the device and reboots, `B` stops the web servers,
   * `U` forces an upgrade, `R` reports; with the option off these actions are
   * suppressed. A 401 (reply invalid, nonce unknown, issuer not trusted)
   * raises `HemUnauthenticatedError`; no login is attempted.
   *
   * @scope none
   * @milestone M1
   */
  postCheckin(checked: string, options?: CallOptions): Promise<CheckinResult>;

  /**
   * Runs a complete check-in: step 1, the check-in relay, step 2. Sets the
   * device clock. A failure names the failing leg in `operation`; without a
   * configured relay it raises `HemUnsupportedError`. See `postCheckin` for
   * the management actions a backend reply can carry.
   *
   * @scope none
   * @milestone M1
   */
  checkin(options?: CallOptions): Promise<CheckinResult>;
}

export function parseStatus(o: JsonObject, operation: string): SystemStatus {
  const time = optNumber(o, "time", operation);
  const ts = optString(o, "ts", operation);
  const storage = o["storage"];
  return {
    initialised: optBoolean(o, "inited", operation) !== false,
    clockSet: time !== undefined || ts !== undefined,
    time,
    ts,
    ctx: reqNumber(o, "ctx", operation),
    uptime: reqNumber(o, "uptime", operation),
    temp: reqNumber(o, "temp", operation),
    flsState: reqNumber(o, "fls_state", operation),
    https: optBoolean(o, "https", operation),
    hostname: optString(o, "hostname", operation),
    trustedTime: optBoolean(o, "tts", operation) !== false,
    fwUpgrade: optBoolean(o, "fw_upgrade", operation) === true,
    storage: Array.isArray(storage) ? storage.filter((s): s is string => typeof s === "string") : undefined,
    format: optString(o, "format", operation),
  };
}

export class SystemApiImpl implements SystemApi {
  readonly #ctx: ClientContext;
  constructor(ctx: ClientContext) {
    this.#ctx = ctx;
  }

  async status(options?: CallOptions): Promise<SystemStatus> {
    const operation = "system.status";
    const res = await sendPublic(this.#ctx, { operation, method: "GET", path: "/api/system/status", ...callOptions(options) });
    return parseStatus(parseObject(res, operation), operation);
  }

  async version(options?: CallOptions): Promise<SystemVersion> {
    const operation = "system.version";
    const res = await sendPublic(this.#ctx, { operation, method: "GET", path: "/api/system/version", ...callOptions(options) });
    const o = parseObject(res, operation);
    return {
      hwv: reqString(o, "hwv", operation),
      fwv: reqString(o, "fwv", operation),
      fwk: reqBytes(o, "fwk", operation),
      fws: reqBytes(o, "fws", operation),
      blv: optString(o, "blv", operation),
      blk: optBytes(o, "blk", operation),
      bls: optBytes(o, "bls", operation),
      sdCsd: optString(o, "sd_csd", operation),
      sdCid: optString(o, "sd_cid", operation),
      uis: optBytes(o, "uis", operation),
    };
  }

  getCheckin(options?: CallOptions): Promise<string> {
    return getCheckin(this.#ctx, options);
  }

  postCheckin(checked: string, options?: CallOptions): Promise<CheckinResult> {
    if (typeof checked !== "string" || checked === "") {
      return Promise.reject(new HemValidationError("checked", "must be a non-empty string"));
    }
    return postCheckin(this.#ctx, checked, options);
  }

  checkin(options?: CallOptions): Promise<CheckinResult> {
    return runCheckin(this.#ctx, options);
  }

  async health(options?: CallOptions): Promise<HealthReport> {
    let status: SystemStatus;
    try {
      status = await this.status(options);
    } catch (e) {
      if (e instanceof HemAbortError) throw e;
      if (e instanceof HemUnreachableError || e instanceof HemTimeoutError) {
        return { reachable: false, initialised: false, selfTestOk: false, clockSet: false, healthy: false, status: undefined, error: e };
      }
      throw e;
    }
    const selfTestOk = status.flsState === 0;
    return {
      reachable: true,
      initialised: status.initialised,
      selfTestOk,
      clockSet: status.clockSet,
      healthy: status.initialised && selfTestOk && status.clockSet,
      status,
      error: undefined,
    };
  }
}
