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

	onMount(() => {
		if (temperatureCanvas) {
			tempChart = createTemperatureChart(temperatureCanvas, data.readings);
		}
		if (humidityCanvas) {
			humidChart = createHumidityChart(humidityCanvas, data.readings);
		}
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
