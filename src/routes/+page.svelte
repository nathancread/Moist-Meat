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

	function updateChartsWithReading(reading: {
		key: string;
		timestamp: number;
		temperature: number | null;
		humidity: number | null;
	}): void {
		console.log('Received new data point from Firebase!');
		const label = new Date(reading.timestamp).toLocaleString();

		if (tempChart) {
			tempChart.data.labels?.push(label);
			tempChart.data.datasets[0].data.push(reading.temperature);
			tempChart.update();
		}

		if (humidChart) {
			humidChart.data.labels?.push(label);
			humidChart.data.datasets[0].data.push(reading.humidity);
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
				updateChartsWithReading(reading);
			} catch (e) {
				console.error('Failed to parse SSE message:', e);
			}
		});

		eventSource.addEventListener('error', (event) => {
			// EventSource auto-reconnects on network errors.
			// Log for debugging but do not close here unless it is a
			// permanent failure (EventSource.CLOSED state).
			if (eventSource.readyState === EventSource.CLOSED) {
				console.error('SSE stream permanently closed', event);
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
