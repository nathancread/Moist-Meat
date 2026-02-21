import { loadSensorData } from "$lib/sensor";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
    const readings = await loadSensorData();
    return {
        readings
    }
}