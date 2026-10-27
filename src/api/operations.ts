/**
 * Every device operation the library binds, as data. Used by the library's
 * own conformance tests; not exported from the package root.
 *
 * @packageDocumentation
 */
import { AUTH_OPERATIONS } from './auth.js';
import type { OperationSpec } from './core.js';
import { CRYPTO_OPERATIONS } from './crypto.js';
import { KEYMGMT_OPERATIONS } from './keymgmt.js';
import { LOGGER_OPERATIONS } from './logger.js';
import { SYSTEM_OPERATIONS } from './system.js';

export const ALL_OPERATIONS: readonly OperationSpec[] = Object.freeze([
  ...AUTH_OPERATIONS,
  ...SYSTEM_OPERATIONS,
  ...KEYMGMT_OPERATIONS,
  ...CRYPTO_OPERATIONS,
  ...LOGGER_OPERATIONS,
]);
