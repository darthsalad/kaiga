import { pick } from '@react-native-documents/picker';
import { showSnackbar } from '../components/Snackbar';
import {
	deleteComic,
	evictionCandidates,
	findBySourceUri,
	getComic,
	getPages,
	insertComic,
	recentlyAccessedIds,
	allComicIds,
	comicsInRoot,
	replacePages,
	updateComic,
	type Comic,
} from '../db/comics';
import { deleteRoot, folderForKey, libraryRoots, pruneEmptyFolders } from '../db/folders';
import { errorCode, errorMessage, Kaiga, type ArchiveEntry } from '../native/kaiga';
import { getSetting } from '../storage/settings';
import { paths } from '../storage/paths';
import { authorityOf, sourceLabelFor, storageFor } from '../utils/format';
import { folderForPickedUri } from '../utils/folders';
import { buildMetadata, displayTitle, META_VERSION, titleForFile } from '../utils/metadata';
import { pageEntries } from '../utils/pages';
import { downloadJobId, finishDownload, trackDownload } from './jobs';

const DAY = 24 * 60 * 60 * 1000;

/** Where the archive is read from: Kaiga's copy, or the original for files already on the phone. */
export function archiveSource(comic: Pick<Comic, 'id' | 'storage' | 'sourceUri'>) {
	return comic.storage === 'direct' ? comic.sourceUri : paths.archive(comic.id);
}

export function isArchiveAvailable(comic: Comic) {
	return comic.localState === 'ready' && (comic.storage === 'direct' || Kaiga.pathExists(paths.archive(comic.id)));
}

const ARCHIVE = /\.(cbz|cbr|cb7|zip|rar|7z)$/i;

// ---- import ----

/**
 * MIME types the picker lets through. Cloud apps often report comic archives as octet-stream,
 * so that has to stay in, and the file name is checked after picking.
 */
const COMIC_TYPES = [
	'application/vnd.comicbook+zip',
	'application/vnd.comicbook-rar',
	'application/x-cbz',
	'application/x-cbr',
	'application/x-cb7',
	'application/zip',
	'application/x-zip-compressed',
	'application/vnd.rar',
	'application/x-rar-compressed',
	'application/x-rar',
	'application/x-7z-compressed',
	'application/octet-stream',
];

export type ImportResult = {
	added: number;
	/** picked files that are not comic archives, by name */
	skipped: string[];
};

/**
 * Opens the system picker (which also lists Google Drive and other cloud apps) and adds every
 * picked comic. Persistent access is requested so the file can be fetched again after cleanup.
 * A comic that then fails to open is taken out of the library again (see downloadAndIndex).
 */
export async function pickAndImport(): Promise<ImportResult> {
	const results = await pick({
		mode: 'open',
		requestLongTermAccess: true,
		allowMultiSelection: true,
		type: COMIC_TYPES,
	});
	const result: ImportResult = { added: 0, skipped: [] };
	for (const file of results) {
		if (file.error || !file.name) {
			continue;
		}
		if (!ARCHIVE.test(file.name)) {
			result.skipped.push(file.name);
			Kaiga.releaseUriPermission(file.uri);
			continue;
		}
		if (await findBySourceUri(file.uri)) {
			continue;
		}
		const id = await insertComic({
			title: titleForFile(file.name),
			sourceUri: file.uri,
			sourceName: file.name,
			sourceLabel: sourceLabelFor(authorityOf(file.uri)),
			sourceSize: file.size,
			storage: storageFor(authorityOf(file.uri)),
			folderId: await pickedFolderId(file.uri),
		});
		enqueue(id);
		result.added++;
	}
	return result;
}

/** Files picked from phone storage join the folder they sit in; cloud files have no visible path. */
async function pickedFolderId(uri: string): Promise<number | null> {
	const ref = folderForPickedUri(uri);
	return ref ? folderForKey(ref.key, ref.name, ref.location) : null;
}

/** Lets the user pick the file again after access was lost (moved, deleted or permission revoked). */
export async function relinkComic(comic: Comic): Promise<boolean> {
	const [file] = await pick({ mode: 'open', requestLongTermAccess: true, type: COMIC_TYPES });
	if (!file || file.error || !file.name) {
		return false;
	}
	if (!ARCHIVE.test(file.name)) {
		Kaiga.releaseUriPermission(file.uri);
		throw new Error(`${file.name} is not a comic archive (CBZ, CBR, CB7, ZIP, RAR or 7z)`);
	}
	const other = await findBySourceUri(file.uri);
	if (other && other.id !== comic.id) {
		throw new Error(`That file is already in your library as "${other.title}"`);
	}
	Kaiga.releaseUriPermission(comic.sourceUri);
	await Kaiga.deletePath(paths.archive(comic.id));
	await updateComic(comic.id, {
		sourceUri: file.uri,
		sourceName: file.name,
		sourceLabel: sourceLabelFor(authorityOf(file.uri)),
		storage: storageFor(authorityOf(file.uri)),
		localState: 'queued',
		error: null,
		...(comic.folderLocked || comic.rootId !== null ? {} : { folderId: await pickedFolderId(file.uri) }),
	});
	await pruneEmptyFolders();
	enqueue(comic.id);
	return true;
}

/** Retries a failed or cleaned-up download in the background. */
export function refetch(comicId: number) {
	enqueue(comicId);
}

// ---- download queue ----

const queue: number[] = [];
const inFlight = new Map<number, Promise<void>>();
let running = false;

function enqueue(comicId: number) {
	if (!queue.includes(comicId)) {
		queue.push(comicId);
	}
	drain();
}

async function drain() {
	if (running) {
		return;
	}
	running = true;
	while (queue.length) {
		const id = queue.shift()!;
		await fetchComic(id).catch(() => undefined);
	}
	running = false;
}

/**
 * Runs at launch: re-queues imports interrupted by the app being killed, and switches comics
 * picked from phone storage before in-place reading existed over to reading the original,
 * deleting the duplicate copy.
 */
export async function resumeInterruptedImports() {
	for (const id of await allComicIds()) {
		const comic = await getComic(id);
		if (!comic) {
			continue;
		}
		// comics added before folders existed join the folder their file sits in
		if (comic.folderId === null && !comic.folderLocked && comic.rootId === null) {
			const folderId = await pickedFolderId(comic.sourceUri);
			if (folderId !== null) {
				await updateComic(id, { folderId });
			}
		}
		if (comic.storage === 'copy' && storageFor(authorityOf(comic.sourceUri)) === 'direct') {
			await Kaiga.deletePath(paths.archive(id));
			await updateComic(id, { storage: 'direct', localSize: comic.sourceSize });
		}
		// files on the phone are cheap to re-check, so give failed ones another go each launch
		// (files from watched folders are re-checked by the folder scan instead)
		const retryLocal =
			comic.storage === 'direct' &&
			comic.rootId === null &&
			(comic.localState === 'unavailable' || comic.localState === 'error');
		const needsMetadata = comic.metaVersion < META_VERSION && isArchiveAvailable(comic);
		if (comic.localState === 'queued' || comic.localState === 'downloading' || retryLocal || needsMetadata) {
			enqueue(id);
		}
	}
}

/**
 * Makes sure the archive is on the phone, downloading it again if it was cleaned up.
 * Concurrent callers share one download.
 */
export function ensureLocal(comicId: number): Promise<void> {
	return fetchComic(comicId);
}

function fetchComic(comicId: number): Promise<void> {
	const existing = inFlight.get(comicId);
	if (existing) {
		return existing;
	}
	const job = downloadAndIndex(comicId).finally(() => inFlight.delete(comicId));
	inFlight.set(comicId, job);
	return job;
}

async function downloadAndIndex(comicId: number) {
	const comic = await getComic(comicId);
	if (!comic) {
		return;
	}
	if (isArchiveAvailable(comic)) {
		// comics added before metadata existed (or before it last improved) are read once more
		if (comic.metaVersion < META_VERSION) {
			const archive = archiveSource(comic);
			await Kaiga.listArchive(archive)
				.then(async listing => updateComic(comicId, await readMetadata(comic, archive, listing.entries)))
				.catch(() => undefined);
		}
		return;
	}
	const archive = archiveSource(comic);
	const copy = comic.storage === 'copy';

	await updateComic(comicId, { localState: copy ? 'downloading' : 'queued', error: null });
	if (copy) {
		trackDownload(comicId);
	}
	try {
		const info = await Kaiga.queryUri(comic.sourceUri);
		const bytes = copy ? await Kaiga.copyUri(downloadJobId(comicId), comic.sourceUri, archive) : info.size;
		const listing = await Kaiga.listArchive(archive);
		const names = listing.entries.map(e => e.name);
		const entries = pageEntries(names);
		if (!entries.length) {
			const nested = names.filter(n => ARCHIVE.test(n)).length;
			throw new Error(
				nested > 0
					? `This file holds ${nested} ${nested === 1 ? 'comic' : 'comics'} instead of pages. Unzip it and add the comics inside.`
					: 'No pages found in this file',
			);
		}

		const changed =
			comic.pageCount !== entries.length ||
			(comic.sourceModified !== null && info.lastModified > 0 && info.lastModified !== comic.sourceModified);
		const known = await getPages(comicId);
		if (changed || known.length === 0) {
			await replacePages(comicId, entries);
			// the file changed underneath us: cached pages may belong to the old version
			await Kaiga.deletePath(paths.pagesDir(comicId));
		}

		const patch: Partial<Comic> = {
			format: listing.format,
			pageCount: entries.length,
			localState: 'ready',
			localSize: bytes,
			sourceSize: info.size > 0 ? info.size : bytes,
			sourceModified: info.lastModified > 0 ? info.lastModified : null,
			lastAccessedAt: Date.now(),
			error: null,
		};
		if (comic.progressPage !== null && comic.progressPage >= entries.length) {
			patch.progressPage = entries.length - 1;
		}
		if (!comic.coverPath || changed) {
			Object.assign(patch, await makeCover(comicId, archive, entries[0], comic.coverVersion));
		}
		if (changed || comic.metaVersion < META_VERSION) {
			Object.assign(patch, await readMetadata(comic, archive, listing.entries));
		}
		await updateComic(comicId, patch);
	} catch (err) {
		const code = errorCode(err);
		const message = code === 'E_NO_ACCESS' ? 'Access to the file was lost. Pick it again.' : errorMessage(err);
		// a picked file that never opened is not a comic Kaiga can read: don't keep it in the library
		// (watched-folder files stay, marked with the error, or the next scan would add them again)
		if (comic.pageCount === 0 && comic.rootId === null && code !== 'E_CANCELLED') {
			await removeComic(comic);
			showSnackbar(`Couldn't add ${comic.sourceName}: ${message}`);
			throw err;
		}
		await updateComic(comicId, {
			localState: code === 'E_NO_ACCESS' || code === 'E_NOT_FOUND' ? 'unavailable' : 'error',
			error: message,
		});
		throw err;
	} finally {
		if (copy) {
			finishDownload(comicId);
		}
	}
}

/** Details from ComicInfo.xml when the archive has one, else from the file name. */
async function readMetadata(comic: Comic, archive: string, entries: ArchiveEntry[]): Promise<Partial<Comic>> {
	// the one at the top level if there are several; skip anything too big to be real metadata
	const entry = entries
		.filter(e => /(^|\/)comicinfo\.xml$/i.test(e.name) && e.size < 1_000_000)
		.sort((a, b) => a.name.length - b.name.length)[0];
	const info = entry ? await Kaiga.readComicInfo(archive, entry.name).catch(() => null) : null;
	const { readingDirection, ...meta } = buildMetadata(info, comic.sourceName);
	return {
		...meta,
		title: displayTitle(meta, comic.sourceName),
		// never undo a direction already set for this comic
		readingDirection: comic.readingDirection ?? readingDirection,
		metaVersion: META_VERSION,
	};
}

async function makeCover(comicId: number, archive: string, firstEntry: string, version: number) {
	const page = paths.page(comicId, 0, firstEntry);
	await Kaiga.extractEntries(`cover-${comicId}`, archive, [firstEntry], [page]);
	const thumb = await Kaiga.makeThumbnail(page, paths.cover(comicId), 480);
	return { coverPath: paths.cover(comicId), coverColor: thumb.color, coverVersion: version + 1 };
}

// ---- removal and cleanup ----

/** Removes the comic from Kaiga. The original file is never touched. */
export async function removeComic(comic: Comic) {
	Kaiga.cancelJob(downloadJobId(comic.id));
	await Promise.all([
		Kaiga.deletePath(paths.archive(comic.id)),
		Kaiga.deletePath(paths.pagesDir(comic.id)),
		Kaiga.deletePath(paths.cover(comic.id)),
	]);
	// a no-op for files from a watched folder: they are covered by the folder's grant, not their own
	Kaiga.releaseUriPermission(comic.sourceUri);
	await deleteComic(comic.id);
	await pruneEmptyFolders();
	if (comic.rootId !== null) {
		await releaseRootIfUnused(comic.rootId);
	}
}

/** Gives up access to a folder Kaiga stopped watching once none of its comics are left. */
export async function releaseRootIfUnused(rootId: number) {
	const root = (await libraryRoots(false)).find(r => r.id === rootId);
	if (!root || root.watching || (await comicsInRoot(rootId)).length > 0) {
		return;
	}
	Kaiga.releaseUriPermission(root.treeUri);
	await deleteRoot(rootId);
}

/** Deletes the archive and cached pages but keeps the cover, progress, rotations and tags. */
export async function evictComic(comic: Comic) {
	await Kaiga.deletePath(paths.archive(comic.id));
	await Kaiga.deletePath(paths.pagesDir(comic.id));
	await updateComic(comic.id, { localState: 'evicted', localSize: null });
}

let openComicId: number | null = null;

/** The reader registers the open comic so cleanup never deletes it mid-read. */
export function setOpenComic(id: number | null) {
	openComicId = id;
}

/**
 * Removes downloads not opened for the configured number of days, and drops extracted page
 * caches for all but the most recently read comics. Runs at launch and when the app returns
 * to the foreground.
 */
export async function runCleanup() {
	const days = getSetting('evictionDays');
	const stale = await evictionCandidates(Date.now() - days * DAY);
	for (const comic of stale) {
		if (comic.id !== openComicId && !inFlight.has(comic.id)) {
			await evictComic(comic);
		}
	}
	// older comics' pages are extracted from the archive again when opened
	const keep = new Set(await recentlyAccessedIds(getSetting('pageCacheComics')));
	for (const id of await allComicIds()) {
		if (!keep.has(id) && id !== openComicId) {
			await Kaiga.deletePath(paths.pagesDir(id));
		}
	}
}

export async function clearDownloads() {
	for (const id of await allComicIds()) {
		const comic = await getComic(id);
		if (
			comic &&
			comic.localState === 'ready' &&
			comic.storage === 'copy' &&
			!comic.keepOffline &&
			comic.id !== openComicId
		) {
			await evictComic(comic);
		}
	}
}
