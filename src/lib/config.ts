/** Firebase Realtime Database path for device readings. */
export const DB_REF_PATH = '/sensors/device1';

/**
 * Only load readings that arrived on or after this date.
 * Expressed as an ISO date string; converted to seconds in sensor.ts.
 */
export const CUTOFF_DATE = '2026-02-16';

/**
 * Temperature threshold above which meat spoilage risk becomes significant.
 * Meat begins to spoil rapidly above 15°C; keeping it at or below this temperature
 * is critical for food safety and preservation.
 */
export const TOO_WARM_TEMP_C = 15;
