import { sentrySvelteKit } from '@sentry/sveltekit';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	build: {
		sourcemap: true
	},
	plugins: [
		sentrySvelteKit({
			org: process.env.SENTRY_ORG || 'gabriel-w6',
			project: process.env.SENTRY_PROJECT || 'moist-meat',
			authToken: process.env.SENTRY_AUTH_TOKEN
		}),
		sveltekit()
	]
});
