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

	// Update charts when filter changes
	$effect(() => {
		const _filter = data.filter; // Track filter changes
		if (!tempChart || !humidChart) return;

		console.log('Filter changed to:', _filter, 'readings:', data.readings.length);
		// Just update the chart data without destroying
		if (tempChart.data.labels && Array.isArray(tempChart.data.datasets[0]?.data)) {
			const labels = data.readings.map((r) => new Date(r.timestamp).toLocaleString());
			const temps = data.readings.map((r) => r.temperature);
			tempChart.data.labels = labels;
			tempChart.data.datasets[0].data = temps;
			tempChart.update();
		}

		if (humidChart.data.labels && Array.isArray(humidChart.data.datasets[0]?.data)) {
			const labels = data.readings.map((r) => new Date(r.timestamp).toLocaleString());
			const humidities = data.readings.map((r) => r.humidity);
			humidChart.data.labels = labels;
			humidChart.data.datasets[0].data = humidities;
			humidChart.update();
		}
	});

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

<h1>Sensor Readings</h1>
<h2>Current Project: <span>Duck Breast Prosciutto</span></h2>

<nav class="filter-links" aria-label="Time filter options">
	<a href="/?filter=all" class:active={data.filter === 'all'} aria-current={data.filter === 'all' ? 'page' : 'false'}>All Time</a>
	<a href="/?filter=1d" class:active={data.filter === '1d'} aria-current={data.filter === '1d' ? 'page' : 'false'}>1 Day</a>
	<a href="/?filter=1h" class:active={data.filter === '1h'} aria-current={data.filter === '1h' ? 'page' : 'false'}>1 Hour</a>
</nav>

<div class="charts-container">
	<section aria-labelledby="temp-heading">
		<h2 id="temp-heading">Temperature Over Time</h2>
		<div class="chart-wrapper">
			<canvas bind:this={temperatureCanvas} aria-label="Temperature readings over time chart"></canvas>
		</div>
	</section>
	<section aria-labelledby="humidity-heading">
		<h2 id="humidity-heading">Humidity Over Time</h2>
		<div class="chart-wrapper">
			<canvas bind:this={humidityCanvas} aria-label="Humidity readings over time chart"></canvas>
		</div>
	</section>
</div>

<style>
	.filter-links {
		display: flex;
		gap: 1rem;
		margin-bottom: 2rem;
		font-size: 0.95rem;
	}

	.filter-links a {
		color: #0066cc;
		text-decoration: none;
		transition: all 0.2s ease;
	}

	.filter-links a:hover {
		text-decoration: underline;
	}

	.filter-links a:focus-visible {
		outline: 2px solid #0066cc;
		outline-offset: 2px;
		border-radius: 2px;
	}

	.filter-links a.active {
		font-weight: bold;
		text-decoration: underline;
	}

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
