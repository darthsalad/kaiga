import { pickDirectory } from '@react-native-documents/picker';
import { comicsInRoot, findBySourceUri, insertComic, listComics, updateComic, type Comic } from '../db/comics';
import { notify } from '../db/changes';
import {
	createManualFolder,
	folderForKey,
	libraryRoots,
	pruneEmptyFolders,
	updateRoot,
	upsertRoot,
	type LibraryRoot,
} from '../db/folders';
import { errorCode, errorMessage, Kaiga, type TreeFile } from '../native/kaiga';
import { getSetting } from '../storage/settings';
import { authorityOf, sourceLabelFor, storageFor } from '../utils/format';
import { folderForRootFile, volumeLabel } from '../utils/folders';
import { titleForFile } from '../utils/metadata';
import { refetch, releaseRootIfUnused, removeComic } from './library';

/** Moves a comic into a folder by hand (or out of one, with null). Scans never undo this. */
export async function moveToFolder(comicId: number, folderId: number | null) {
	await updateComic(comicId, { folderId, folderLocked: true });
	await pruneEmptyFolders();
}

export async function moveToNewFolder(comicId: number, name: string) {
	const id = await createManualFolder(name);
	await moveToFolder(comicId, id);
	return id;
}

// ---- watched library folders ----

/** "content://…/tree/primary%3AComics" -> its document id, "primary:Comics". */
function treeDocumentId(treeUri: string) {
	const match = /\/tree\/([^/]+)/.exec(treeUri);
	return match ? decodeURIComponent(match[1]) : null;
}

async function describeTree(treeUri: string): Promise<{ name: string; label: string }> {
	const id = treeDocumentId(treeUri);
	const authority = authorityOf(treeUri);
	if (id && authority === 'com.android.externalstorage.documents') {
		const [volume, path = ''] = id.split(':');
		const segments = path.split('/').filter(Boolean);
		return { name: segments[segments.length - 1] ?? volumeLabel(volume), label: volumeLabel(volume) };
	}
	try {
		const info = await Kaiga.queryUri(`${treeUri}/document/${encodeURIComponent(id ?? '')}`);
		return { name: info.name || 'Folder', label: sourceLabelFor(authority) };
	} catch {
		return { name: 'Folder', label: sourceLabelFor(authority) };
	}
}

/** Asks for a folder, starts watching it, and imports what's inside. */
export async function addLibraryFolder(): Promise<ScanResult & { name: string }> {
	const picked = await pickDirectory({ requestLongTermAccess: true });
	const { name, label } = await describeTree(picked.uri);
	const id = await upsertRoot(picked.uri, name, label);
	const root = (await libraryRoots()).find(r => r.id === id)!;
	return { ...(await scanRoot(root)), name };
}

export type ScanResult = { added: number; missing: number; returned: number };

let scanning: Promise<ScanResult> | null = null;

/** Scans every watched folder. Overlapping calls share the running scan. */
export function scanAllRoots(): Promise<ScanResult> {
	if (!scanning) {
		scanning = (async () => {
			const total: ScanResult = { added: 0, missing: 0, returned: 0 };
			for (const root of await libraryRoots()) {
				const r = await scanRoot(root).catch(() => ({ added: 0, missing: 0, returned: 0 }));
				total.added += r.added;
				total.missing += r.missing;
				total.returned += r.returned;
			}
			return total;
		})().finally(() => {
			scanning = null;
		});
	}
	return scanning;
}

/**
 * Syncs the library with one watched folder:
 * - new files are added and grouped by the sub-folder they sit in;
 * - a file that disappeared while another with the same size and date appeared was renamed or
 *   moved, so the existing comic follows it and keeps its progress;
 * - a comic picked on its own earlier is adopted when the scan finds the same file;
 * - files still missing are marked missing (or removed, if the user turned that off);
 * - missing files that come back are picked up again.
 */
export async function scanRoot(root: LibraryRoot): Promise<ScanResult> {
	let files: TreeFile[];
	try {
		files = await Kaiga.listTree(root.treeUri);
	} catch (err) {
		const code = errorCode(err);
		await updateRoot(root.id, {
			error:
				code === 'E_NO_ACCESS' || code === 'E_NOT_FOUND' ? 'Access lost · pick the folder again' : errorMessage(err),
		});
		throw err;
	}

	const known = await comicsInRoot(root.id);
	const byUri = new Map(known.map(c => [c.sourceUri, c]));
	const seen = new Set<number>();
	const fresh: TreeFile[] = [];
	const result: ScanResult = { added: 0, missing: 0, returned: 0 };

	for (const file of files) {
		const comic = byUri.get(file.uri);
		if (comic) {
			seen.add(comic.id);
			await syncFile(root, comic, file, result);
		} else {
			fresh.push(file);
		}
	}

	const gone = known.filter(c => !seen.has(c.id));
	const loose = (await listComics({ kind: 'all' }, '')).filter(c => c.rootId === null);
	for (const file of fresh) {
		// renamed or moved inside the folder
		const renamed = gone.find(
			c =>
				!seen.has(c.id) &&
				c.sourceSize === file.size &&
				file.lastModified > 0 &&
				c.sourceModified === file.lastModified,
		);
		// the same file added earlier through the file picker
		const adopted = renamed ? undefined : loose.find(c => c.sourceName === file.name && c.sourceSize === file.size);
		const existing = renamed ?? adopted;
		if (existing) {
			seen.add(existing.id);
			if (adopted) {
				Kaiga.releaseUriPermission(adopted.sourceUri);
			}
			await updateComic(existing.id, { sourceUri: file.uri, sourceName: file.name, rootId: root.id });
			await syncFile(root, { ...existing, sourceUri: file.uri, rootId: root.id }, file, result);
			continue;
		}
		if (await findBySourceUri(file.uri)) {
			continue;
		}
		const authority = authorityOf(file.uri);
		const ref = folderForRootFile(root.id, root.name, file.path);
		const id = await insertComic({
			title: titleForFile(file.name),
			sourceUri: file.uri,
			sourceName: file.name,
			sourceLabel: root.label ?? sourceLabelFor(authority),
			sourceSize: file.size > 0 ? file.size : null,
			sourceModified: file.lastModified > 0 ? file.lastModified : null,
			storage: storageFor(authority),
			folderId: ref ? await folderForKey(ref.key, ref.name, ref.location) : null,
			rootId: root.id,
			rootPath: file.path,
		});
		refetch(id);
		result.added++;
	}

	const keepMissing = getSetting('keepMissing');
	for (const comic of known.filter(c => !seen.has(c.id))) {
		if (!keepMissing) {
			await removeComic(comic);
		} else if (comic.localState !== 'unavailable') {
			await updateComic(comic.id, { localState: 'unavailable', error: 'This file is no longer in the folder.' });
		}
		result.missing++;
	}

	await pruneEmptyFolders();
	await updateRoot(root.id, { lastScanAt: Date.now(), error: null });
	notify('comics');
	return result;
}

/** Brings one known file up to date: its folder, a missing file returning, or a changed file. */
async function syncFile(root: LibraryRoot, comic: Comic, file: TreeFile, result: ScanResult) {
	const patch: Partial<Comic> = {};
	if (comic.rootPath !== file.path) {
		patch.rootPath = file.path;
		patch.sourceName = file.name;
	}
	if (!comic.folderLocked) {
		const ref = folderForRootFile(root.id, root.name, file.path);
		const folderId = ref ? await folderForKey(ref.key, ref.name, ref.location) : null;
		if (folderId !== comic.folderId) {
			patch.folderId = folderId;
		}
	}
	const changed =
		comic.localState === 'ready' &&
		file.lastModified > 0 &&
		comic.sourceModified !== null &&
		file.lastModified !== comic.sourceModified;
	if (comic.localState === 'unavailable' || changed) {
		// re-read: the file came back, or its contents changed
		patch.localState = 'queued';
		patch.error = null;
		if (comic.localState === 'unavailable') {
			result.returned++;
		}
	}
	if (Object.keys(patch).length) {
		await updateComic(comic.id, patch);
	}
	if (patch.localState === 'queued') {
		refetch(comic.id);
	}
}

/**
 * Stops scanning a folder. Its comics stay in the library and stay readable, since the folder's
 * access grant is kept for them; removing the last of them releases it.
 */
export async function stopWatching(root: LibraryRoot) {
	await updateRoot(root.id, { watching: false });
	await releaseRootIfUnused(root.id);
}
