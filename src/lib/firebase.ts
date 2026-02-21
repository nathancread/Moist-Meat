import { initializeApp, cert, getApps, type App, type ServiceAccount } from 'firebase-admin/app';
import { getDatabase, type Database } from 'firebase-admin/database';
import { join } from 'node:path';

const SERVICE_ACCOUNT_PATH = join(
	process.cwd(),
	'moist-meat-monitor-firebase-adminsdk-fbsvc-a2be73f4d8.json'
);
const DATABASE_URL = 'https://moist-meat-monitor-default-rtdb.firebaseio.com/';

async function loadServiceAccount(): Promise<ServiceAccount> {
	const file = Bun.file(SERVICE_ACCOUNT_PATH);
	const config = await file.json();
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

export async function getFirebaseDatabase(): Promise<Database> {
	if (!database) {
		await initFirebase();
	}
	return database!;
}
