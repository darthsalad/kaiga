import { open, type DB, type Scalar } from '@op-engineering/op-sqlite';
import { migrations } from './migrations';

let db: DB | null = null;

export function getDb(): DB {
	if (!db) {
		db = open({ name: 'kaiga.db' });
		db.executeSync('PRAGMA journal_mode = WAL');
		db.executeSync('PRAGMA foreign_keys = ON');
	}
	return db;
}

/** Applies every migration newer than the database's `user_version`, each in its own transaction. */
export async function migrate() {
	const database = getDb();
	const version = Number(database.executeSync('PRAGMA user_version').rows[0]?.user_version ?? 0);
	for (let v = version; v < migrations.length; v++) {
		const statements = migrations[v];
		await database.transaction(async tx => {
			for (const sql of statements) {
				await tx.execute(sql);
			}
			await tx.execute(`PRAGMA user_version = ${v + 1}`);
		});
	}
}

export async function all<T>(sql: string, params: Scalar[] = []): Promise<T[]> {
	const result = await getDb().execute(sql, params);
	return result.rows as T[];
}

export async function first<T>(sql: string, params: Scalar[] = []): Promise<T | undefined> {
	const rows = await all<T>(sql, params);
	return rows[0];
}

export async function run(sql: string, params: Scalar[] = []) {
	return getDb().execute(sql, params);
}
