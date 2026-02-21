import { error } from '@sveltejs/kit';
import { loadSensorData } from '$lib/sensor';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	try {
		const readings = await loadSensorData();
		return { readings };
	} catch (e) {
		const message = e instanceof Error ? e.message : 'Unknown error loading sensor data';
		error(500, { message });
	}
};
