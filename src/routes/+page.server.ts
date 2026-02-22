import { error } from '@sveltejs/kit';
import * as Sentry from '@sentry/sveltekit';
import { loadSensorData } from '$lib/sensor';
import logger from '$lib/logger';
import type { PageServerLoad } from './$types';
import type { Reading } from '$lib/types';

type TimeFilter = 'all' | '1h' | '1d';

function filterReadings(readings: Reading[], filter: TimeFilter): Reading[] {
	if (filter === 'all') return readings;

	const now = Date.now();
	const filterMs = filter === '1h' ? 1000 * 60 * 60 : 1000 * 60 * 60 * 24;

	return readings.filter((reading) => now - reading.timestamp < filterMs);
}

export const load: PageServerLoad = async ({ url }) => {
	try {
		logger.info('Loading page data');
		const rawReadings = await loadSensorData();
		const filter = (url.searchParams.get('filter') ?? 'all') as TimeFilter;
		const readings = filterReadings(rawReadings, filter);
		logger.info('Page data loaded successfully');
		return { readings, filter };
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error loading sensor data';
		const details = e instanceof Error ? e.stack : String(e);
		logger.error({ error: e, message, details }, 'Failed to load page data');
		Sentry.captureException(e);
		error(500, {
			message: 'Failed to load sensor data. Please try again later.'
		});
	}
};
