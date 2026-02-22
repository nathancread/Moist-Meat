import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: import.meta.env.PUBLIC_SENTRY_DSN,

	// Capture a sample of client-side transactions for performance monitoring
	tracesSampleRate: 0.1,

	// Capture session replays only when an error occurs (not for all sessions)
	replaysOnErrorSampleRate: 1.0,
	replaysSessionSampleRate: 0,

	integrations: [
		Sentry.replayIntegration({
			// Mask all text and block all media by default for privacy
			maskAllText: true,
			blockAllMedia: true
		})
	],

	environment: import.meta.env.MODE
});
