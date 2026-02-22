import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://56ba426131c040c7bc44abd98ae5c721@o4510497587068928.ingest.us.sentry.io/4510927910207488',

	tracesSampleRate: 1.0

	// uncomment the line below to enable Spotlight (https://spotlightjs.com)
	// spotlight: import.meta.env.DEV,
});
