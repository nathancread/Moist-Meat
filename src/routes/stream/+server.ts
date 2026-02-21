import { initFirebase } from '$lib/firebase';
import type { DataSnapshot } from 'firebase-admin/database';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	// Read the `since` query param (milliseconds from the client).
	// Fall back to 0 if absent.
	const sinceMs = parseInt(url.searchParams.get('since') ?? '0', 10);

	// Convert to seconds because that is what Firebase stores.
	const sinceSeconds = Math.floor(sinceMs / 1000);

	// Get the Admin SDK database reference.
	const { database } = await initFirebase();
	const ref = database
		.ref('/sensors/device1')
		.orderByChild('timestamp')
		.startAfter(sinceSeconds);

	// Build a ReadableStream that owns the Firebase listener lifetime.
	let firebaseUnsubscribe: (() => void) | null = null;

	const stream = new ReadableStream({
		start(controller) {
			// Attach `child_added` listener. Firebase Admin SDK fires this
			// for every existing child first, then for each new child as
			// they arrive. Because we used startAfter(sinceSeconds), only
			// data strictly after the last-seen reading is included.
			const handler = (snapshot: DataSnapshot) => {
				const val = snapshot.val();
				if (!val) return;

				const reading = {
					key: snapshot.key,
					timestamp: typeof val.timestamp === 'number'
						? val.timestamp * 1000   // normalize to ms
						: parseFloat(String(val.timestamp)) * 1000,
					temperature: val.temperature ?? null,
					humidity: val.humidity ?? null
				};

				// Format as SSE. Each event must end with \n\n.
				const payload = `data: ${JSON.stringify(reading)}\n\n`;
				try {
					controller.enqueue(new TextEncoder().encode(payload));
				} catch {
					// Controller already closed (client disconnected).
				}
			};

			ref.on('child_added', handler);

			// Store the cleanup function for use in `cancel`.
			firebaseUnsubscribe = () => ref.off('child_added', handler);
		},

		cancel() {
			// Called when the client closes the connection.
			// This is the correct place to detach the Firebase listener.
			if (firebaseUnsubscribe) {
				firebaseUnsubscribe();
				firebaseUnsubscribe = null;
			}
		}
	});

	// Return the SSE response.
	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive'
		}
	});
};
