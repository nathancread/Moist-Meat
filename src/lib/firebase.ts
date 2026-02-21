import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

const SERVICE_ACCOUNT_PATH = join(
	process.cwd(),
	'moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json'
);
const DATABASE_URL = 'https://moist-meat-monitor-default-rtdb.firebaseio.com/';

async function loadServiceAccount(): Promise<ServiceAccount> {
	const raw = await readFile(SERVICE_ACCOUNT_PATH, 'utf-8');
	const config = JSON.parse(raw) as Record<string, string>;
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
		app = getApps()[0];
		database = getDatabase(app);
	} else {
		app = initializeApp({
			credential: cert(await loadServiceAccount()),
			databaseURL: DATABASE_URL
		});
		database = getDatabase(app);
	}
	return { app: app!, database: database! };
}
