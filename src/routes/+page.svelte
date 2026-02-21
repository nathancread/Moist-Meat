<script lang="ts">
	import type { PageProps } from './$types';
	let { data }: PageProps = $props();
	import { Chart, registerables } from 'chart.js';
	Chart.register(...registerables);
	import { onMount, tick } from 'svelte';

	let temperatureCanvas: HTMLCanvasElement;
	let humidityCanvas: HTMLCanvasElement;

	onMount(async () => {
		await tick();

		// Prepare data from readings
		const labels = data.readings.map((r) => new Date(r.timestamp).toLocaleString());
		const temperatureData = data.readings.map((r) => r.temperature);
		const humidityData = data.readings.map((r) => r.humidity);

		// Temperature chart
		if (temperatureCanvas) {
			const ctx = temperatureCanvas.getContext('2d');
			if (ctx) {
				const temperatureAnnotationPlugin = {
					id: 'temperatureAnnotations',
					afterDatasetsDraw(chart: any) {
						const yScale = chart.scales.y;
						const ctx = chart.ctx;

						// Dangerous thresholds for prosciutto curing
						const tooWarmTemp = 4; // °C - Risk of spoilage

						// Draw "Too Warm" line
						const warmY = yScale.getPixelForValue(tooWarmTemp);
						ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
						ctx.lineWidth = 2;
						ctx.setLineDash([5, 5]);
						ctx.beginPath();
						ctx.moveTo(chart.chartArea.left, warmY);
						ctx.lineTo(chart.chartArea.right, warmY);
						ctx.stroke();

						// Label for "Too Warm" (inside right side)
						ctx.fillStyle = 'rgba(255, 0, 0, 0.7)';
						ctx.font = '12px sans-serif';
						ctx.textAlign = 'right';
						ctx.fillText(`Too Warm (${tooWarmTemp}°C)`, chart.chartArea.right - 5, warmY - 5);

						ctx.setLineDash([]);
					}
				};

				new Chart(ctx, {
					type: 'line',
					data: {
						labels,
						datasets: [
							{
								label: 'Temperature (°C)',
								borderColor: 'rgb(255, 99, 132)',
								backgroundColor: 'rgba(255, 99, 132, 0.1)',
								data: temperatureData,
								borderWidth: 2,
								pointRadius: 0
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								min: 0,
								max: 30
							}
						},
						plugins: {
							legend: {
								display: true
							}
						}
					},
					plugins: [temperatureAnnotationPlugin]
				});
			}
		}

		// Humidity chart
		if (humidityCanvas) {
			const ctx = humidityCanvas.getContext('2d');
			if (ctx) {
				new Chart(ctx, {
					type: 'line',
					data: {
						labels,
						datasets: [
							{
								label: 'Humidity (%)',
								borderColor: 'rgb(54, 162, 235)',
								backgroundColor: 'rgba(54, 162, 235, 0.1)',
								data: humidityData,
								borderWidth: 2,
								pointRadius: 0
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						scales: {
							y: {
								min: 0,
								max: 100
							}
						},
						plugins: {
							legend: {
								display: true
							}
						}
					}
				});
			}
		}
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
