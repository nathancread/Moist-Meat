import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';
import logger from './logger';

const SERVICE_ACCOUNT_PATH = join(
	process.cwd(),
	'moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json'
);
const DATABASE_URL = 'https://moist-meat-monitor-default-rtdb.firebaseio.com/';

async function loadServiceAccount(): Promise<ServiceAccount> {
	let raw: string;

	// Try to load from environment variables (for Vercel)
	if (process.env.FIREBASE_CREDENTIALS_JSON) {
		logger.debug('Loading Firebase service account from FIREBASE_CREDENTIALS_JSON environment variable');
		raw = process.env.FIREBASE_CREDENTIALS_JSON;
	} else if (process.env.FIREBASE_CREDENTIALS_B64) {
		logger.debug('Loading Firebase service account from FIREBASE_CREDENTIALS_B64 environment variable');
		raw = Buffer.from(process.env.FIREBASE_CREDENTIALS_B64, 'base64').toString('utf-8');
	} else {
		// Fall back to file (for local development)
		logger.debug({ path: SERVICE_ACCOUNT_PATH }, 'Loading Firebase service account from file');
		raw = await readFile(SERVICE_ACCOUNT_PATH, 'utf-8');
	}

	const config = JSON.parse(raw) as Record<string, string>;
	logger.debug('Firebase service account loaded successfully');
	return {
		projectId: config.project_id,
		privateKey: config.private_key,
		clientEmail: config.client_email
	};
}

let app: App | undefined;
let database: Database | undefined;

export async function initFirebase(): Promise<{ app: App; database: Database }> {
	if (getApps().length > 0) {
		logger.debug('Firebase app already initialized, reusing existing instance');
		app = getApps()[0];
		database = getDatabase(app);
	} else {
		logger.info('Initializing Firebase app');
		app = initializeApp({
			credential: cert(await loadServiceAccount()),
			databaseURL: DATABASE_URL
		});
		database = getDatabase(app);
		logger.info({ databaseURL: DATABASE_URL }, 'Firebase app initialized successfully');
	}
	return { app: app!, database: database! };
}
