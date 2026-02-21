import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import logger from './logger';
import { requireEnv } from './utils';

const DATABASE_URL = 'https://moist-meat-monitor-default-rtdb.firebaseio.com/';

async function loadServiceAccount(): Promise<ServiceAccount> {
	logger.debug(
		'Loading Firebase service account from FIREBASE_CREDENTIALS_B64 environment variable'
	);
	const credentialsB64 = requireEnv('FIREBASE_CREDENTIALS_B64');
	const raw = Buffer.from(credentialsB64, 'base64').toString('utf-8');
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

	if (!app || !database) {
		throw new Error('Firebase initialization failed: app or database is undefined');
	}

	return { app, database };
}
