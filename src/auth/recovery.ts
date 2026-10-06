/**
 * "Recover once through check-in": when an operation fails because the
 * device clock is unset or has drifted, run one check-in (which sets the
 * clock) and try the operation once more.
 *
 * @packageDocumentation
 */
import { copyError, HemError } from '../errors.js';
import type { CallOptions } from '../transport/transport.js';

/** Runs one complete check-in. */
export type CheckinRunner = (options: CallOptions) => Promise<unknown>;

/** Largest tolerated difference between device and local time, in seconds. */
export const DRIFT_TOLERANCE_SECONDS = 60;

/**
 * Whether a challenge's `exp` (device time + 60 s) shows that the device
 * clock differs from local time by more than {@link DRIFT_TOLERANCE_SECONDS}.
 */
export function showsDrift(challengeExp: number, localNowMs: number): boolean {
  const deviceNow = challengeExp - 60;
  return Math.abs(deviceNow - localNowMs / 1000) > DRIFT_TOLERANCE_SECONDS;
}

/** A copy of `error` with `cause` attached. */
function withCause(error: unknown, cause: unknown): unknown {
  return error instanceof HemError ? copyError(error, { cause }) : error;
}

/** Runs an operation with at most one recovery check-in. */
// implements: REQ-AUTH-009
export class ClockRecovery {
  readonly #checkin: CheckinRunner | null;

  /** `checkin` is `null` when recovery is switched off or no check-in relay is configured. */
  constructor(checkin: CheckinRunner | null) {
    this.#checkin = checkin;
  }

  /** Whether a recovery check-in can be run at all. */
  get available(): boolean {
    return this.#checkin !== null;
  }

  /**
   * Run `attempt`. If it fails with an error for which `isClockError` holds,
   * run one check-in and `attempt` once more; a second failure is reported
   * as it is. Without a check-in, or when the check-in fails, the first error
   * is reported (with the check-in failure as its `cause`).
   */
  async once<T>(attempt: () => Promise<T>, isClockError: (error: unknown) => boolean, options: CallOptions): Promise<T> {
    try {
      return await attempt();
    } catch (error) {
      if (!this.#checkin || !isClockError(error)) throw error;
      try {
        await this.#checkin(options);
      } catch (checkinError) {
        throw withCause(error, checkinError);
      }
      return attempt();
    }
  }
}
