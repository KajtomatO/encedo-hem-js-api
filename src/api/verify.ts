/**
 * Result semantics of verify operations: the device answers a valid
 * signature or MAC with 200 and an invalid one with an error status; the
 * binding turns that into `true` or `false`.
 *
 * @packageDocumentation
 */
import { HemOperationFailedError } from '../errors.js';

/**
 * Run a verify operation: a success response gives `true`; a response
 * `isInvalid` accepts gives `false`; every other failure (other statuses,
 * transport errors, validation) is raised unchanged.
 */
// implements: REQ-OPS-004
export async function verified(run: () => Promise<unknown>, isInvalid: (error: unknown) => boolean = isMismatch): Promise<boolean> {
  try {
    await run();
    return true;
  } catch (error) {
    if (isInvalid(error)) return false;
    throw error;
  }
}

/**
 * The device reports a mismatch with 406 — the same status it uses for a
 * missing key or a key of the wrong type, so `false` covers those too.
 */
export function isMismatch(error: unknown): boolean {
  return error instanceof HemOperationFailedError;
}
