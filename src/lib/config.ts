/** Firebase Realtime Database path for device readings. */
export const DB_REF_PATH = '/sensors/device1';

/**
 * Only load readings that arrived on or after this date.
 * Expressed as an ISO date string; converted to seconds in sensor.ts.
 */
export const CUTOFF_DATE = '2026-02-16';

/** Temperature above which meat spoilage risk is significant (°C). */
export const TOO_WARM_TEMP_C = 15;
