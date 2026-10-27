import { notify } from './changes';
import { all, first, run } from './database';

export type Folder = {
	id: number;
	key: string | null;
	name: string;
	location: string | null;
	manual: boolean;
};

type FolderRow = { id: number; key: string | null; name: string; location: string | null; manual: number };

const toFolder = (r: FolderRow): Folder => ({
	id: r.id,
	key: r.key,
	name: r.name,
	location: r.location,
	manual: r.manual === 1,
});

export async function allFolders(): Promise<Folder[]> {
	return (await all<FolderRow>('SELECT * FROM folders ORDER BY name COLLATE NOCASE')).map(toFolder);
}

export async function getFolder(id: number): Promise<Folder | undefined> {
	const row = await first<FolderRow>('SELECT * FROM folders WHERE id = ?', [id]);
	return row && toFolder(row);
}

/** The folder for a directory, created on first use. A renamed folder keeps its new name. */
export async function folderForKey(key: string, name: string, location: string): Promise<number> {
	await run('INSERT INTO folders (key, name, location, created_at) VALUES (?, ?, ?, ?) ON CONFLICT (key) DO NOTHING', [
		key,
		name,
		location,
		Date.now(),
	]);
	const row = await first<{ id: number }>('SELECT id FROM folders WHERE key = ?', [key]);
	notify('folders');
	return row!.id;
}

export async function createManualFolder(name: string): Promise<number> {
	const result = await run(
		'INSERT INTO folders (key, name, location, manual, created_at) VALUES (NULL, ?, NULL, 1, ?)',
		[name.trim(), Date.now()],
	);
	notify('folders');
	return result.insertId!;
}

export async function renameFolder(id: number, name: string) {
	await run('UPDATE folders SET name = ? WHERE id = ?', [name.trim(), id]);
	notify('folders');
}

/** Folders with nothing left in them disappear. */
export async function pruneEmptyFolders() {
	const result = await run(
		'DELETE FROM folders WHERE id NOT IN (SELECT folder_id FROM comics WHERE folder_id IS NOT NULL)',
	);
	if (result.rowsAffected) {
		notify('folders');
	}
}

// ---- watched library folders ----

export type LibraryRoot = {
	id: number;
	treeUri: string;
	name: string;
	label: string | null;
	watching: boolean;
	lastScanAt: number | null;
	error: string | null;
	comicCount: number;
	folderCount: number;
};

type RootRow = {
	id: number;
	tree_uri: string;
	name: string;
	label: string | null;
	watching: number;
	last_scan_at: number | null;
	error: string | null;
	comic_count: number;
	folder_count: number;
};

export async function libraryRoots(onlyWatching = true): Promise<LibraryRoot[]> {
	const rows = await all<RootRow>(
		`SELECT r.*,
			(SELECT COUNT(*) FROM comics c WHERE c.root_id = r.id) AS comic_count,
			(SELECT COUNT(DISTINCT c.folder_id) FROM comics c WHERE c.root_id = r.id AND c.folder_id IS NOT NULL) AS folder_count
		 FROM library_roots r ${onlyWatching ? 'WHERE watching = 1' : ''} ORDER BY name COLLATE NOCASE`,
	);
	return rows.map(r => ({
		id: r.id,
		treeUri: r.tree_uri,
		name: r.name,
		label: r.label,
		watching: r.watching === 1,
		lastScanAt: r.last_scan_at,
		error: r.error,
		comicCount: r.comic_count,
		folderCount: r.folder_count,
	}));
}

/** Adds a watched folder, or starts watching it again if it was added before. */
export async function upsertRoot(treeUri: string, name: string, label: string): Promise<number> {
	await run(
		`INSERT INTO library_roots (tree_uri, name, label, added_at) VALUES (?, ?, ?, ?)
		 ON CONFLICT (tree_uri) DO UPDATE SET watching = 1, error = NULL`,
		[treeUri, name, label, Date.now()],
	);
	const row = await first<{ id: number }>('SELECT id FROM library_roots WHERE tree_uri = ?', [treeUri]);
	notify('roots');
	return row!.id;
}

export async function updateRoot(
	id: number,
	patch: { lastScanAt?: number; error?: string | null; watching?: boolean },
) {
	const sets: string[] = [];
	const values: (string | number | null)[] = [];
	if (patch.lastScanAt !== undefined) {
		sets.push('last_scan_at = ?');
		values.push(patch.lastScanAt);
	}
	if (patch.error !== undefined) {
		sets.push('error = ?');
		values.push(patch.error);
	}
	if (patch.watching !== undefined) {
		sets.push('watching = ?');
		values.push(patch.watching ? 1 : 0);
	}
	if (!sets.length) {
		return;
	}
	await run(`UPDATE library_roots SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
	notify('roots');
}

export async function deleteRoot(id: number) {
	await run('DELETE FROM library_roots WHERE id = ?', [id]);
	notify('roots');
}
