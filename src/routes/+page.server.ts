import { error } from '@sveltejs/kit';
import { loadSensorData } from '$lib/sensor';
import logger from '$lib/logger';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		logger.info('Loading page data');
		const readings = await loadSensorData();
		logger.info('Page data loaded successfully');
		return { readings };
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error loading sensor data';
		const details = e instanceof Error ? e.stack : String(e);
		logger.error({ error: e, message, details }, 'Failed to load page data');
		error(500, {
			message: 'Failed to load sensor data. Please try again later.'
		});
	}
};
