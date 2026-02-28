/**
 * Prints when the latest sensor reading was written to Firebase.
 *
 * Usage:
 *   FIREBASE_CREDENTIALS_B64=<base64-creds> bun run scripts/latest-reading.ts
 */

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

const DATABASE_URL = 'https://moist-meat-monitor-default-rtdb.firebaseio.com/';
const DB_REF_PATH = '/sensors/device1';

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`Required environment variable ${name} is not set`);
	return value;
}

const credentialsB64 = requireEnv('FIREBASE_CREDENTIALS_B64');
const config = JSON.parse(Buffer.from(credentialsB64, 'base64').toString('utf-8')) as Record<string, string>;

const serviceAccount: ServiceAccount = {
	projectId: config.project_id,
	privateKey: config.private_key,
	clientEmail: config.client_email
};

const app = initializeApp({ credential: cert(serviceAccount), databaseURL: DATABASE_URL });
const db = getDatabase(app);

const ref = db.ref(DB_REF_PATH).orderByChild('timestamp').limitToLast(1);
const snapshot = await ref.once('value');
const raw = snapshot.val() as Record<string, { timestamp?: unknown }> | null;

if (!raw) {
	console.log('No sensor readings found.');
	process.exit(0);
}

const [key, entry] = Object.entries(raw)[0];
const timestampSeconds = Number(entry.timestamp);

if (isNaN(timestampSeconds)) {
	console.error(`Could not parse timestamp for key "${key}":`, entry.timestamp);
	process.exit(1);
}

const date = new Date(timestampSeconds * 1000);
const secondsAgo = Math.round((Date.now() - date.getTime()) / 1000);

console.log(`Latest reading key : ${key}`);
console.log(`Timestamp (seconds): ${timestampSeconds}`);
console.log(`Written at         : ${date.toISOString()} (local: ${date.toLocaleString()})`);
console.log(`Age                : ${secondsAgo}s ago`);

process.exit(0);
