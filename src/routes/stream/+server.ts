import { initFirebase } from '$lib/firebase';
import * as Sentry from '@sentry/sveltekit';
import logger from '$lib/logger';
import { parseTimestampSeconds, parseNumeric } from '$lib/utils';
import type { DataSnapshot } from 'firebase-admin/database';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	// Read the `since` query param (milliseconds from the client).
	// Fall back to 0 if absent, and validate it is non-negative and reasonable.
	const sinceMs = parseInt(url.searchParams.get('since') ?? '0', 10);
	const now = Date.now();

	if (sinceMs < 0 || sinceMs > now) {
		logger.warn({ sinceMs, now }, 'Invalid since parameter');
		return new Response('Invalid since parameter', { status: 400 });
	}

	// Convert to seconds because that is what Firebase stores.
	const sinceSeconds = Math.floor(sinceMs / 1000);

	logger.info({ sinceMs, sinceSeconds }, 'SSE stream connection established');

	// Get the Admin SDK database reference.
	const { database } = await initFirebase();
	const ref = database.ref('/sensors/device1').orderByChild('timestamp').startAfter(sinceSeconds);

	// Build a ReadableStream that owns the Firebase listener lifetime.
	let firebaseUnsubscribe: (() => void) | null = null;
	let timeoutHandle: NodeJS.Timeout | null = null;

	const stream = new ReadableStream({
		start(controller) {
			try {
				// Set a 5-minute timeout for the SSE connection.
				// If Firebase listener has no activity, close the stream to avoid resource leaks.
				timeoutHandle = setTimeout(
					() => {
						logger.info('SSE stream timeout (5 minutes), closing connection');
						controller.close();
					},
					5 * 60 * 1000
				);

				// Attach `child_added` listener. Firebase Admin SDK fires this
				// for every existing child first, then for each new child as
				// they arrive. Because we used startAfter(sinceSeconds), only
				// data strictly after the last-seen reading is included.
				const handler = (snapshot: DataSnapshot) => {
					try {
						const val = snapshot.val();
						if (!val) return;

						const timestamp = parseTimestampSeconds(val.timestamp);
						if (timestamp === null) {
							logger.warn({ key: snapshot.key }, 'Invalid timestamp in sensor reading, skipping');
							return;
						}

						const reading = {
							key: snapshot.key,
							timestamp,
							temperature: parseNumeric(val.temperature),
							humidity: parseNumeric(val.humidity)
						};

						logger.debug(
							{ key: reading.key, timestamp: reading.timestamp },
							'Streaming sensor reading'
						);

						// Format as SSE. Each event must end with \n\n.
						const payload = `data: ${JSON.stringify(reading)}\n\n`;
						controller.enqueue(new TextEncoder().encode(payload));
					} catch (e) {
						logger.error(e, 'Error processing sensor reading');
						Sentry.captureException(e);
					}
				};

				ref.on('child_added', handler);

				// Store the cleanup function for use in `cancel`.
				firebaseUnsubscribe = () => ref.off('child_added', handler);
				logger.debug('Firebase listener attached');
			} catch (e) {
				logger.error(e, 'Failed to start SSE stream');
				Sentry.captureException(e);
				controller.error(new Error('Failed to initialize sensor stream'));
			}
		},

		cancel() {
			// Called when the client closes the connection.
			// This is the correct place to detach the Firebase listener and cleanup.
			if (timeoutHandle) {
				clearTimeout(timeoutHandle);
				timeoutHandle = null;
			}
			if (firebaseUnsubscribe) {
				firebaseUnsubscribe();
				firebaseUnsubscribe = null;
				logger.info('SSE stream connection closed, Firebase listener detached');
			}
		}
	});

	// Return the SSE response.
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
