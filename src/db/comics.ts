import { all, first, getDb, run } from './database';
import type { ReadingDirection } from '../storage/settings';
import { notify } from './changes';

export type LocalState = 'queued' | 'downloading' | 'ready' | 'evicted' | 'error' | 'unavailable';
export type Storage = 'copy' | 'direct';

export type Comic = {
	id: number;
	title: string;
	format: string | null;
	sourceUri: string;
	sourceName: string;
	sourceLabel: string | null;
	sourceSize: number | null;
	sourceModified: number | null;
	storage: Storage;
	folderId: number | null;
	folderLocked: boolean;
	rootId: number | null;
	rootPath: string | null;
	pageCount: number;
	coverPath: string | null;
	coverColor: string | null;
	coverVersion: number;
	localState: LocalState;
	localSize: number | null;
	error: string | null;
	keepOffline: boolean;
	bookmarked: boolean;
	progressPage: number | null;
	lastOpenedAt: number | null;
	lastAccessedAt: number | null;
	addedAt: number;
	series: string | null;
	issueNumber: string | null;
	issueCount: number | null;
	volume: number | null;
	year: number | null;
	summary: string | null;
	writer: string | null;
	artist: string | null;
	publisher: string | null;
	genre: string | null;
	readingDirection: ReadingDirection | null;
	metaVersion: number;
};

type ComicRow = {
	id: number;
	title: string;
	format: string | null;
	source_uri: string;
	source_name: string;
	source_label: string | null;
	source_size: number | null;
	source_modified: number | null;
	storage: Storage;
	folder_id: number | null;
	folder_locked: number;
	root_id: number | null;
	root_path: string | null;
	page_count: number;
	cover_path: string | null;
	cover_color: string | null;
	cover_version: number;
	local_state: LocalState;
	local_size: number | null;
	error: string | null;
	keep_offline: number;
	bookmarked: number;
	progress_page: number | null;
	last_opened_at: number | null;
	last_accessed_at: number | null;
	added_at: number;
	series: string | null;
	issue_number: string | null;
	issue_count: number | null;
	volume: number | null;
	year: number | null;
	summary: string | null;
	writer: string | null;
	artist: string | null;
	publisher: string | null;
	genre: string | null;
	reading_direction: ReadingDirection | null;
	meta_version: number;
};

const toComic = (r: ComicRow): Comic => ({
	id: r.id,
	title: r.title,
	format: r.format,
	sourceUri: r.source_uri,
	sourceName: r.source_name,
	sourceLabel: r.source_label,
	sourceSize: r.source_size,
	sourceModified: r.source_modified,
	storage: r.storage,
	folderId: r.folder_id,
	folderLocked: r.folder_locked === 1,
	rootId: r.root_id,
	rootPath: r.root_path,
	pageCount: r.page_count,
	coverPath: r.cover_path,
	coverColor: r.cover_color,
	coverVersion: r.cover_version,
	localState: r.local_state,
	localSize: r.local_size,
	error: r.error,
	keepOffline: r.keep_offline === 1,
	bookmarked: r.bookmarked === 1,
	progressPage: r.progress_page,
	lastOpenedAt: r.last_opened_at,
	lastAccessedAt: r.last_accessed_at,
	addedAt: r.added_at,
	series: r.series,
	issueNumber: r.issue_number,
	issueCount: r.issue_count,
	volume: r.volume,
	year: r.year,
	summary: r.summary,
	writer: r.writer,
	artist: r.artist,
	publisher: r.publisher,
	genre: r.genre,
	readingDirection: r.reading_direction,
	metaVersion: r.meta_version,
});

const columns: Record<keyof Omit<Comic, 'id'>, string> = {
	title: 'title',
	format: 'format',
	sourceUri: 'source_uri',
	sourceName: 'source_name',
	sourceLabel: 'source_label',
	sourceSize: 'source_size',
	sourceModified: 'source_modified',
	storage: 'storage',
	folderId: 'folder_id',
	folderLocked: 'folder_locked',
	rootId: 'root_id',
	rootPath: 'root_path',
	pageCount: 'page_count',
	coverPath: 'cover_path',
	coverColor: 'cover_color',
	coverVersion: 'cover_version',
	localState: 'local_state',
	localSize: 'local_size',
	error: 'error',
	keepOffline: 'keep_offline',
	bookmarked: 'bookmarked',
	progressPage: 'progress_page',
	lastOpenedAt: 'last_opened_at',
	lastAccessedAt: 'last_accessed_at',
	addedAt: 'added_at',
	series: 'series',
	issueNumber: 'issue_number',
	issueCount: 'issue_count',
	volume: 'volume',
	year: 'year',
	summary: 'summary',
	writer: 'writer',
	artist: 'artist',
	publisher: 'publisher',
	genre: 'genre',
	readingDirection: 'reading_direction',
	metaVersion: 'meta_version',
};

export type LibraryFilter =
	{ kind: 'all' } | { kind: 'bookmarked' } | { kind: 'reading' } | { kind: 'onPhone' } | { kind: 'tag'; tagId: number };

export async function listComics(filter: LibraryFilter, search: string): Promise<Comic[]> {
	const where: string[] = [];
	const params: (string | number)[] = [];
	switch (filter.kind) {
		case 'bookmarked':
			where.push('bookmarked = 1');
			break;
		case 'reading':
			where.push('progress_page IS NOT NULL AND progress_page < page_count - 1');
			break;
		case 'onPhone':
			where.push(`local_state = 'ready'`);
			break;
		case 'tag':
			where.push('id IN (SELECT comic_id FROM comic_tags WHERE tag_id = ?)');
			params.push(filter.tagId);
			break;
		case 'all':
			break;
	}
	// a personal library is small enough that LIKE beats keeping a full-text index in sync
	for (const word of search.trim().split(/\s+/).filter(Boolean)) {
		where.push(`(title LIKE ? ESCAPE '\\' OR source_name LIKE ? ESCAPE '\\')`);
		const pattern = `%${word.replace(/[\\%_]/g, m => `\\${m}`)}%`;
		params.push(pattern, pattern);
	}
	const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
	const rows = await all<ComicRow>(`SELECT * FROM comics ${clause} ORDER BY title COLLATE NOCASE`, params);
	return rows.map(toComic);
}

export async function continueReading(limit = 6): Promise<Comic[]> {
	const rows = await all<ComicRow>(
		`SELECT * FROM comics
		 WHERE last_opened_at IS NOT NULL AND progress_page IS NOT NULL AND progress_page < page_count - 1
		 ORDER BY last_opened_at DESC LIMIT ?`,
		[limit],
	);
	return rows.map(toComic);
}

export async function history(): Promise<Comic[]> {
	const rows = await all<ComicRow>(
		'SELECT * FROM comics WHERE last_opened_at IS NOT NULL ORDER BY last_opened_at DESC',
	);
	return rows.map(toComic);
}

export async function getComic(id: number): Promise<Comic | undefined> {
	const row = await first<ComicRow>('SELECT * FROM comics WHERE id = ?', [id]);
	return row && toComic(row);
}

export async function findBySourceUri(uri: string): Promise<Comic | undefined> {
	const row = await first<ComicRow>('SELECT * FROM comics WHERE source_uri = ?', [uri]);
	return row && toComic(row);
}

/** localBytes counts only copies Kaiga made, not files read in place. */
export async function libraryStats(): Promise<{ count: number; localBytes: number }> {
	const row = await first<{ count: number; bytes: number | null }>(
		`SELECT COUNT(*) AS count,
		 SUM(CASE WHEN local_state = 'ready' AND storage = 'copy' THEN local_size END) AS bytes FROM comics`,
	);
	return { count: row?.count ?? 0, localBytes: row?.bytes ?? 0 };
}

export async function insertComic(
	data: Pick<Comic, 'title' | 'sourceUri' | 'sourceName' | 'sourceLabel' | 'sourceSize' | 'storage'> &
		Partial<Pick<Comic, 'sourceModified' | 'folderId' | 'rootId' | 'rootPath'>>,
): Promise<number> {
	const result = await run(
		`INSERT INTO comics (title, source_uri, source_name, source_label, source_size, source_modified, storage,
			folder_id, root_id, root_path, added_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		[
			data.title,
			data.sourceUri,
			data.sourceName,
			data.sourceLabel,
			data.sourceSize,
			data.sourceModified ?? null,
			data.storage,
			data.folderId ?? null,
			data.rootId ?? null,
			data.rootPath ?? null,
			Date.now(),
		],
	);
	notify('comics');
	return result.insertId!;
}

export async function updateComic(id: number, patch: Partial<Omit<Comic, 'id'>>) {
	const keys = Object.keys(patch) as (keyof typeof columns)[];
	if (!keys.length) {
		return;
	}
	const values = keys.map(k => {
		const v = patch[k];
		return typeof v === 'boolean' ? (v ? 1 : 0) : (v ?? null);
	});
	await run(`UPDATE comics SET ${keys.map(k => `${columns[k]} = ?`).join(', ')} WHERE id = ?`, [...values, id]);
	notify('comics');
}

export async function deleteComic(id: number) {
	await run('DELETE FROM comics WHERE id = ?', [id]);
	await run('DELETE FROM tags WHERE id NOT IN (SELECT tag_id FROM comic_tags)');
	notify('comics', 'tags', 'pages');
}

/** Opening a comic both records history and restarts its eviction clock. */
export async function markOpened(id: number, page: number) {
	const now = Date.now();
	await run('UPDATE comics SET progress_page = ?, last_opened_at = ?, last_accessed_at = ? WHERE id = ?', [
		page,
		now,
		now,
		id,
	]);
	notify('comics');
}

export async function saveProgress(id: number, page: number) {
	await run('UPDATE comics SET progress_page = ?, last_accessed_at = ? WHERE id = ?', [page, Date.now(), id]);
	notify('comics');
}

/** Swipe-to-delete in History: forget progress but keep the file, rotations and tags. */
export async function removeFromHistory(id: number) {
	await run('UPDATE comics SET progress_page = NULL, last_opened_at = NULL WHERE id = ?', [id]);
	notify('comics');
}

export async function restoreHistory(id: number, progressPage: number | null, lastOpenedAt: number | null) {
	await run('UPDATE comics SET progress_page = ?, last_opened_at = ? WHERE id = ?', [progressPage, lastOpenedAt, id]);
	notify('comics');
}

export async function evictionCandidates(olderThan: number): Promise<Comic[]> {
	const rows = await all<ComicRow>(
		`SELECT * FROM comics
		 WHERE local_state = 'ready' AND storage = 'copy' AND keep_offline = 0
		   AND (last_accessed_at IS NULL OR last_accessed_at < ?)`,
		[olderThan],
	);
	return rows.map(toComic);
}

export async function recentlyAccessedIds(limit: number): Promise<number[]> {
	const rows = await all<{ id: number }>(
		'SELECT id FROM comics WHERE last_accessed_at IS NOT NULL ORDER BY last_accessed_at DESC LIMIT ?',
		[limit],
	);
	return rows.map(r => r.id);
}

export async function allComics(): Promise<Comic[]> {
	return (await all<ComicRow>('SELECT * FROM comics')).map(toComic);
}

export async function comicsInRoot(rootId: number): Promise<Comic[]> {
	return (await all<ComicRow>('SELECT * FROM comics WHERE root_id = ?', [rootId])).map(toComic);
}

export async function comicsInFolder(folderId: number): Promise<Comic[]> {
	return (await all<ComicRow>('SELECT * FROM comics WHERE folder_id = ?', [folderId])).map(toComic);
}

export async function allComicIds(): Promise<number[]> {
	const rows = await all<{ id: number }>('SELECT id FROM comics');
	return rows.map(r => r.id);
}

// ---- pages ----

export type Page = {
	index: number;
	entryName: string;
	width: number | null;
	height: number | null;
};

export async function getPages(comicId: number): Promise<Page[]> {
	const rows = await all<{ idx: number; entry_name: string; width: number | null; height: number | null }>(
		'SELECT idx, entry_name, width, height FROM pages WHERE comic_id = ? ORDER BY idx',
		[comicId],
	);
	return rows.map(r => ({ index: r.idx, entryName: r.entry_name, width: r.width, height: r.height }));
}

/** Replaces the page list. Sizes survive for entries whose name did not change. */
export async function replacePages(comicId: number, entryNames: string[]) {
	const old = await getPages(comicId);
	const sizes = new Map(old.map(p => [p.entryName, p]));
	await getDb().transaction(async tx => {
		await tx.execute('DELETE FROM pages WHERE comic_id = ?', [comicId]);
		for (let i = 0; i < entryNames.length; i++) {
			const prev = sizes.get(entryNames[i]);
			await tx.execute('INSERT INTO pages (comic_id, idx, entry_name, width, height) VALUES (?, ?, ?, ?, ?)', [
				comicId,
				i,
				entryNames[i],
				prev?.width ?? null,
				prev?.height ?? null,
			]);
		}
		await tx.execute(
			`DELETE FROM page_rotations WHERE comic_id = ? AND entry_name NOT IN (SELECT entry_name FROM pages WHERE comic_id = ?)`,
			[comicId, comicId],
		);
	});
	notify('pages');
}

export async function savePageSizes(comicId: number, sizes: { index: number; width: number; height: number }[]) {
	if (!sizes.length) {
		return;
	}
	await getDb().transaction(async tx => {
		for (const s of sizes) {
			await tx.execute('UPDATE pages SET width = ?, height = ? WHERE comic_id = ? AND idx = ?', [
				s.width,
				s.height,
				comicId,
				s.index,
			]);
		}
	});
}

// ---- rotations ----

export type Rotation = 0 | 90 | 180 | 270;

export async function getRotations(comicId: number): Promise<Map<string, Rotation>> {
	const rows = await all<{ entry_name: string; rotation: Rotation }>(
		'SELECT entry_name, rotation FROM page_rotations WHERE comic_id = ?',
		[comicId],
	);
	return new Map(rows.map(r => [r.entry_name, r.rotation]));
}

export async function setRotation(comicId: number, entryName: string, rotation: Rotation) {
	if (rotation === 0) {
		await run('DELETE FROM page_rotations WHERE comic_id = ? AND entry_name = ?', [comicId, entryName]);
	} else {
		await run(
			`INSERT INTO page_rotations (comic_id, entry_name, rotation) VALUES (?, ?, ?)
			 ON CONFLICT (comic_id, entry_name) DO UPDATE SET rotation = excluded.rotation`,
			[comicId, entryName, rotation],
		);
	}
	notify('pages');
}

export async function rotatedPageCount(comicId: number): Promise<number> {
	const row = await first<{ n: number }>('SELECT COUNT(*) AS n FROM page_rotations WHERE comic_id = ?', [comicId]);
	return row?.n ?? 0;
}
