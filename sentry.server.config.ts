import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: process.env.SENTRY_DSN,

	// Capture 10% of all server-side transactions for performance monitoring
	tracesSampleRate: 0.1,

	// Environment tag helps distinguish prod vs dev errors in the Sentry UI
	environment: process.env.NODE_ENV ?? 'development'
});
