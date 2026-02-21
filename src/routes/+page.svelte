<script lang="ts">
	import { Chart, registerables } from 'chart.js';
	import { onMount, onDestroy } from 'svelte';
	import type { PageProps } from './$types';
	import type { Chart as ChartInstance } from 'chart.js';
	import { createTemperatureChart, createHumidityChart } from '$lib/charts';

	Chart.register(...registerables);

	let { data }: PageProps = $props();

	let temperatureCanvas: HTMLCanvasElement | undefined = $state();
	let humidityCanvas: HTMLCanvasElement | undefined = $state();

	let tempChart: ChartInstance | undefined;
	let humidChart: ChartInstance | undefined;

	// Track consecutive parse errors to limit reconnection attempts
	let consecutiveErrors = 0;
	const MAX_CONSECUTIVE_ERRORS = 5;

	// Keep chart data bounded to prevent memory leaks
	// Only show the last 1000 data points
	const MAX_DATA_POINTS = 1000;

	function updateChartsWithReading(reading: {
		key: string;
		timestamp: number;
		temperature: number | null;
		humidity: number | null;
	}): void {
		console.log('Received new data point from Firebase!');
		const label = new Date(reading.timestamp).toLocaleString();

		if (tempChart && tempChart.data.labels && Array.isArray(tempChart.data.datasets[0]?.data)) {
			tempChart.data.labels.push(label);
			tempChart.data.datasets[0].data.push(reading.temperature);

			// Prune old data to prevent memory leaks
			if (tempChart.data.labels.length > MAX_DATA_POINTS) {
				tempChart.data.labels.shift();
				tempChart.data.datasets[0].data.shift();
			}

			tempChart.update();
		}

		if (humidChart && humidChart.data.labels && Array.isArray(humidChart.data.datasets[0]?.data)) {
			humidChart.data.labels.push(label);
			humidChart.data.datasets[0].data.push(reading.humidity);

			// Prune old data to prevent memory leaks
			if (humidChart.data.labels.length > MAX_DATA_POINTS) {
				humidChart.data.labels.shift();
				humidChart.data.datasets[0].data.shift();
			}

			humidChart.update();
		}
	}

	onMount(() => {
		if (temperatureCanvas) {
			tempChart = createTemperatureChart(temperatureCanvas, data.readings);
		}
		if (humidityCanvas) {
			humidChart = createHumidityChart(humidityCanvas, data.readings);
		}

		// Compute the latest timestamp from the initial load.
		// data.readings is sorted ascending, so the last element is newest.
		const latestTimestamp =
			data.readings.length > 0 ? data.readings[data.readings.length - 1].timestamp : 0;

		// Open the SSE connection, passing the latest timestamp.
		const eventSource = new EventSource(`/stream?since=${latestTimestamp}`);

		eventSource.addEventListener('message', (event) => {
			try {
				const reading = JSON.parse(event.data);
				consecutiveErrors = 0; // Reset error counter on successful message
				updateChartsWithReading(reading);
			} catch (e) {
				consecutiveErrors++;
				console.error(
					`Failed to parse SSE message (error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
					e
				);

				// Close the stream after too many consecutive parse errors
				if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
					console.error('Too many consecutive parse errors, closing SSE stream');
					eventSource.close();
				}
			}
		});

		eventSource.addEventListener('error', (event) => {
			// EventSource auto-reconnects on network errors.
			// Log for debugging but do not close here unless it is a
			// permanent failure (EventSource.CLOSED state).
			if (eventSource.readyState === EventSource.CLOSED) {
				console.error('SSE stream permanently closed', event);
			} else {
				consecutiveErrors++;
				console.warn(
					`SSE connection error (error ${consecutiveErrors}/${MAX_CONSECUTIVE_ERRORS}):`,
					event
				);

				// Close the stream after too many consecutive errors
				if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
					console.error('Too many consecutive connection errors, closing SSE stream');
					eventSource.close();
				}
			}
		});

		// Return a cleanup function from onMount.
		// Svelte calls this when the component is destroyed.
		return () => {
			eventSource.close();
		};
	});

	onDestroy(() => {
		tempChart?.destroy();
		humidChart?.destroy();
	});
</script>

<div class="charts-container">
	<div>
		<h2>Temperature Over Time</h2>
		<div class="chart-wrapper">
			<canvas bind:this={temperatureCanvas}></canvas>
		</div>
	</div>
	<div>
		<h2>Humidity Over Time</h2>
		<div class="chart-wrapper">
			<canvas bind:this={humidityCanvas}></canvas>
		</div>
	</div>
</div>

<style>
	.charts-container {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		width: 100%;
	}

	.chart-wrapper {
		width: 100%;
		aspect-ratio: 6 / 1 !important;
	}

	.chart-wrapper canvas {
		display: block;
		max-width: 100%;
	}
</style>
