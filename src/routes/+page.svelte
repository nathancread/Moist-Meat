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
								borderWidth: 2
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: true,
						plugins: {
							legend: {
								display: true
							}
						}
					}
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
								borderWidth: 2
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: true,
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

<div style="display: flex; flex-direction: column; gap: 2rem; width: 100%; max-width: 800px; margin: 0 auto;">
	<div>
		<h2>Temperature Over Time</h2>
		<div style="width: 100%; height: 400px;">
			<canvas bind:this={temperatureCanvas}></canvas>
		</div>
	</div>
	<div>
		<h2>Humidity Over Time</h2>
		<div style="width: 100%; height: 400px;">
			<canvas bind:this={humidityCanvas}></canvas>
		</div>
	</div>
</div>
