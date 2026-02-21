/**
 * Firebase Realtime Database schema for sensor readings.
 * All numeric values are required to be finite numbers.
 */
export interface FirebaseReading {
	timestamp: number;
	temperature?: number;
	humidity?: number;
}

/**
 * Client-facing reading with validated data and key.
 */
export interface Reading {
	key: string;
	timestamp: number;
	temperature: number | null;
	humidity: number | null;
}
