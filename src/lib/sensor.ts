import { initFirebase } from '$lib/firebase';

export interface Reading {
	key: string;
	timestamp: number;
	temperature: number | null;
	humidity: number | null;
}

const DB_REF_PATH = '/sensors/device1';

function parseTimestamp(ts: unknown): number {
	const num = typeof ts === 'number' ? ts : parseFloat(String(ts));
	return isNaN(num) ? 0 : num;
}

export async function loadSensorData(): Promise<Reading[]> {
	const { database } = await initFirebase();
	if (!database) {
		throw new Error('Firebase not initialized');
	}

	const ref = database.ref(DB_REF_PATH);
	const snapshot = await ref.once('value');
	const raw = snapshot.val();

	if (!raw) {
		return [];
	}

	const readings: Reading[] = Object.entries(raw)
		.filter(([, entry]) => typeof entry === 'object' && entry !== null)
		.map(([key, entry]) => {
			const typedEntry = entry as Record<string, unknown>;
			return {
				key,
				timestamp: parseTimestamp(typedEntry.timestamp),
				temperature: typedEntry.temperature as number | null,
				humidity: typedEntry.humidity as number | null
			};
		});

	readings.sort((a, b) => a.timestamp - b.timestamp);

	return readings;
}
