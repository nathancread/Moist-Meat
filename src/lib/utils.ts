/**
 * Parse a timestamp in seconds and convert to milliseconds.
 * @param timestampSeconds - Value that may be a number or numeric string
 * @returns Millisecond timestamp, or null if the input cannot be parsed
 */
export function parseTimestampSeconds(timestampSeconds: unknown): number | null {
	const num =
		typeof timestampSeconds === 'number' ? timestampSeconds : parseFloat(String(timestampSeconds));
	if (isNaN(num)) return null;
	return num * 1000;
}

/**
 * Validate and return a numeric value if it is finite, otherwise null.
 * @param value - Potential numeric value
 * @returns The value if finite, otherwise null
 */
export function parseNumeric(value: unknown): number | null {
	return typeof value === 'number' && isFinite(value) ? value : null;
}

/**
 * Validate that an environment variable exists and is non-empty.
 * @param name - Environment variable name
 * @throws Error if the variable is missing or empty
 * @returns The environment variable value
 */
export function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Required environment variable ${name} is not set`);
	}
	return value;
}
