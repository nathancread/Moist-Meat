import { initFirebase } from '$lib/firebase';
import { DB_REF_PATH, CUTOFF_DATE } from '$lib/config';
import logger from '$lib/logger';

export interface Reading {
	key: string;
	timestamp: number;
	temperature: number | null;
	humidity: number | null;
}

/** Returns a millisecond timestamp, or null if the input cannot be parsed. */
function parseTimestamp(timestampSeconds: unknown): number | null {
	const num =
		typeof timestampSeconds === 'number' ? timestampSeconds : parseFloat(String(timestampSeconds));
	if (isNaN(num)) return null;
	return num * 1000;
}

/** Returns the value if it is a finite number, otherwise null. */
function parseNumeric(value: unknown): number | null {
	return typeof value === 'number' && isFinite(value) ? value : null;
}

export async function loadSensorData(): Promise<Reading[]> {
	logger.info('Loading sensor data from Firebase');
	const { database } = await initFirebase();

	const cutoffDateSeconds = Math.floor(new Date(CUTOFF_DATE).getTime() / 1000);
	logger.debug({ path: DB_REF_PATH, cutoffDate: CUTOFF_DATE, cutoffDateSeconds }, 'Querying sensor data');
	const ref = database.ref(DB_REF_PATH).orderByChild('timestamp').startAfter(cutoffDateSeconds);
	const snapshot = await ref.once('value');
	const raw = snapshot.val();

	if (!raw) {
		logger.info('No sensor data found after cutoff date');
		return [];
	}

	const readings: Reading[] = Object.entries(raw as Record<string, unknown>)
		.filter(([, entry]) => typeof entry === 'object' && entry !== null)
		.flatMap(([key, entry]) => {
			const typedEntry = entry as Record<string, unknown>;
			const timestamp = parseTimestamp(typedEntry.timestamp);
			if (timestamp === null) return [];
			return [
				{
					key,
					timestamp,
					temperature: parseNumeric(typedEntry.temperature),
					humidity: parseNumeric(typedEntry.humidity)
				}
			];
		});

	readings.sort((a, b) => a.timestamp - b.timestamp);

	logger.info({ count: readings.length }, 'Sensor data loaded successfully');
	return readings;
}
