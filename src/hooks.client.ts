import { handleErrorWithSentry } from '@sentry/sveltekit';

// The Sentry client config is initialized in sentry.client.config.ts

// If you have a custom error handler, pass it to `handleErrorWithSentry`
export const handleError = handleErrorWithSentry();
