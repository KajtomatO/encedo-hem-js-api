// What a device test imports: the environment helpers of device-env.ts plus the
// `describe` that skips the whole block when no device is configured.
// implements: REQ-TEST-003 — without EHEM_TEST_URL the device describes are skipped, not failed.
import { describe } from 'vitest';
import { deviceEnv } from './device-env.js';

export { DEFAULT_PACE_MS, type DeviceEnv, type DeviceTls, deviceClient, deviceEnv, deviceFetch, readDeviceEnv, requireDevice } from './device-env.js';

/** `describe` for tests that need the device: skipped, not failed, without `EHEM_TEST_URL`. */
export const describeDevice = describe.skipIf(deviceEnv === undefined);
