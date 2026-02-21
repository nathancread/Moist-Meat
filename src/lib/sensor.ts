import { initFirebase } from '$lib/firebase';
import { DB_REF_PATH, CUTOFF_DATE } from '$lib/config';
import logger from '$lib/logger';
import { parseTimestampSeconds, parseNumeric } from '$lib/utils';
import type { Reading, FirebaseReading } from '$lib/types';

export type { Reading } from '$lib/types';

export async function loadSensorData(): Promise<Reading[]> {
	logger.info('Loading sensor data from Firebase');
	const { database } = await initFirebase();

	const cutoffDateSeconds = Math.floor(new Date(CUTOFF_DATE).getTime() / 1000);
	logger.debug(
		{ path: DB_REF_PATH, cutoffDate: CUTOFF_DATE, cutoffDateSeconds },
		'Querying sensor data'
	);
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
			const typedEntry = entry as FirebaseReading;
			const timestamp = parseTimestampSeconds(typedEntry.timestamp);
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
