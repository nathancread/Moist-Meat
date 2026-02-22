import { sequence } from '@sveltejs/kit/hooks';
import { handleErrorWithSentry, sentryHandle } from '@sentry/sveltekit';
import * as Sentry from '@sentry/sveltekit';
import logger from '$lib/logger';
import type { HandleServerError } from '@sveltejs/kit';

// If you have custom handlers, make sure to place them after `sentryHandle()` in the `sequence` function.
export const handle = sequence(sentryHandle());

const myErrorHandler: HandleServerError = async ({ error, event, status, message }) => {
	// Pino logs the full error with structured context for your server logs
	logger.error(
		{
			error,
			status,
			routeId: event.route.id,
			url: event.url.pathname
		},
		message ?? 'Unhandled server error'
	);

	// Return the sanitized error message that SvelteKit exposes to clients
	// Do not expose raw error details to the browser
	return {
		message: status === 500 ? 'An internal server error occurred.' : message
	};
};

// Wrap your handler with Sentry - this adds Sentry.captureException around it
export const handleError = handleErrorWithSentry(myErrorHandler);
