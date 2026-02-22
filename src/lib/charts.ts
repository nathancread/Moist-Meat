import { Chart, type Plugin } from 'chart.js';
import { TOO_WARM_TEMP_C } from '$lib/config';
import type { Reading } from '$lib/sensor';

// --- Named color constants ---
const TEMPERATURE_BORDER = 'rgb(255, 159, 64)';
const TEMPERATURE_FILL = 'rgba(255, 159, 64, 0.1)';
const HUMIDITY_BORDER = 'rgb(54, 162, 235)';
const HUMIDITY_FILL = 'rgba(54, 162, 235, 0.1)';
const THRESHOLD_STROKE = 'rgba(255, 0, 0, 0.5)';
const THRESHOLD_LABEL = 'rgba(255, 0, 0, 0.7)';

// --- Temperature annotation plugin ---
const temperatureAnnotationPlugin: Plugin = {
	id: 'temperatureAnnotations',
	afterDatasetsDraw(chart: Chart): void {
		const yScale = chart.scales['y'];
		const ctx = chart.ctx;

		const warmY = yScale.getPixelForValue(TOO_WARM_TEMP_C);

		ctx.strokeStyle = THRESHOLD_STROKE;
		ctx.lineWidth = 2;
		ctx.setLineDash([5, 5]);
		ctx.beginPath();
		ctx.moveTo(chart.chartArea.left, warmY);
		ctx.lineTo(chart.chartArea.right, warmY);
		ctx.stroke();

		ctx.fillStyle = THRESHOLD_LABEL;
		ctx.font = '12px sans-serif';
		ctx.textAlign = 'right';
		ctx.fillText(`Too Warm (${TOO_WARM_TEMP_C}\u00b0C)`, chart.chartArea.right - 5, warmY - 5);

		ctx.setLineDash([]);
	}
};

// --- Public factory functions ---

export function createTemperatureChart(canvas: HTMLCanvasElement, readings: Reading[]): Chart {
	const labels = readings.map((r) => new Date(r.timestamp).toLocaleString());
	const tempData = readings.map((r) => r.temperature);

	return new Chart(canvas, {
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label: 'Temperature (\u00b0C)',
					borderColor: TEMPERATURE_BORDER,
					backgroundColor: TEMPERATURE_FILL,
					data: tempData,
					borderWidth: 2,
					pointRadius: 0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			plugins: { legend: { display: true } }
		},
		plugins: [temperatureAnnotationPlugin]
	});
}

export function createHumidityChart(canvas: HTMLCanvasElement, readings: Reading[]): Chart {
	const labels = readings.map((r) => new Date(r.timestamp).toLocaleString());
	const humidData = readings.map((r) => r.humidity);

	return new Chart(canvas, {
		type: 'line',
		data: {
			labels,
			datasets: [
				{
					label: 'Humidity (%)',
					borderColor: HUMIDITY_BORDER,
					backgroundColor: HUMIDITY_FILL,
					data: humidData,
					borderWidth: 2,
					pointRadius: 0
				}
			]
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			scales: { y: { min: 0, max: 100 } },
			plugins: { legend: { display: true } }
		}
	});
}
