import { issueOrder } from './metadata';
import { naturalCompare } from './naturalSort';

/** Where a file lives, when its URI reveals it. */
export type FileLocation = {
	/** storage volume, e.g. "primary" or an SD card id like "1A2B-3C4D" */
	volume: string;
	/** path segments from the volume root, ending with the file name */
	segments: string[];
};

/** The document id is the last `/document/<id>` part, also for URIs inside a picked tree. */
export function documentIdOf(uri: string): string | null {
	const match = /\/document\/([^/]+)$/.exec(uri);
	return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Recovers a file's path from a document URI. Only providers whose document ids are paths reveal
 * one: phone storage and SD cards ("primary:Download/x.cbr"), and Downloads entries backed by a raw
 * path. Google Drive and most cloud apps use opaque ids, so this returns null for them.
 */
export function locationFromUri(uri: string): FileLocation | null {
	const authority = /^content:\/\/([^/]+)/.exec(uri)?.[1];
	const docId = documentIdOf(uri);
	if (!authority || !docId) {
		return null;
	}
	if (authority === 'com.android.externalstorage.documents') {
		const colon = docId.indexOf(':');
		if (colon < 0) {
			return null;
		}
		const segments = docId
			.slice(colon + 1)
			.split('/')
			.filter(Boolean);
		return segments.length ? { volume: docId.slice(0, colon), segments } : null;
	}
	if (authority === 'com.android.providers.downloads.documents' && docId.startsWith('raw:')) {
		const path = docId.slice(4);
		const primary = /^\/storage\/emulated\/\d+\/(.+)$/.exec(path);
		if (primary) {
			return { volume: 'primary', segments: primary[1].split('/').filter(Boolean) };
		}
		const card = /^\/storage\/([^/]+)\/(.+)$/.exec(path);
		if (card) {
			return { volume: card[1], segments: card[2].split('/').filter(Boolean) };
		}
	}
	return null;
}

export function volumeLabel(volume: string) {
	return volume === 'primary' ? 'Phone storage' : 'SD card';
}

export type FolderRef = {
	/** stable identity; the same directory always maps to the same key */
	key: string;
	name: string;
	/** where the folder sits, for disambiguating folders with the same name */
	location: string;
};

/**
 * The folder a file belongs to: its immediate parent directory. Files whose parent is shallower
 * than [minDepth] stay ungrouped, so everything sitting directly in Download (depth 1) or at the
 * top of a library folder doesn't collapse into one giant group.
 */
export function folderFor(scope: string, label: string, segments: string[], minDepth: number): FolderRef | null {
	const dirs = segments.slice(0, -1);
	if (dirs.length < minDepth || dirs.length === 0) {
		return null;
	}
	return {
		key: `${scope}|${dirs.join('/')}`,
		name: dirs[dirs.length - 1],
		location: [label, ...dirs.slice(0, -1)].join(' › '),
	};
}

/** Folder for a file picked on its own: needs to sit at least two levels deep (Download/Series/x). */
export function folderForPickedUri(uri: string): FolderRef | null {
	const loc = locationFromUri(uri);
	if (!loc) {
		return null;
	}
	return folderFor(`vol:${loc.volume}`, volumeLabel(loc.volume), loc.segments, 2);
}

/** Folder for a file found in a watched library folder: any sub-folder of it. */
export function folderForRootFile(rootId: number, rootName: string, relativePath: string): FolderRef | null {
	return folderFor(`root:${rootId}`, rootName, relativePath.split('/').filter(Boolean), 1);
}

export type Groupable = { id: number; title: string; sourceName: string; folderId: number | null };
export type FolderInfo = { id: number; name: string; manual: boolean };

export type LibraryItem<C extends Groupable, F extends FolderInfo> =
	{ kind: 'folder'; key: string; folder: F; comics: C[] } | { kind: 'comic'; key: string; comic: C };

/** Issue number when both comics have one, else file name. */
export function readingOrder(
	a: { issueNumber?: string | null; sourceName: string },
	b: { issueNumber?: string | null; sourceName: string },
) {
	return issueOrder(a, b, naturalCompare);
}

/**
 * Builds the library grid: a folder appears once it holds two or more comics (or the user made
 * it); a folder with a single comic shows that comic on its own. Comics inside a folder are in
 * reading order (see readingOrder) so issues read in sequence.
 */
export function groupLibrary<C extends Groupable, F extends FolderInfo>(
	comics: C[],
	folders: F[],
): LibraryItem<C, F>[] {
	const byId = new Map(folders.map(f => [f.id, f]));
	const members = new Map<number, C[]>();
	const loose: C[] = [];
	for (const c of comics) {
		if (c.folderId !== null && byId.has(c.folderId)) {
			members.set(c.folderId, [...(members.get(c.folderId) ?? []), c]);
		} else {
			loose.push(c);
		}
	}
	const items: LibraryItem<C, F>[] = [];
	for (const [folderId, list] of members) {
		const folder = byId.get(folderId)!;
		if (list.length >= 2 || folder.manual) {
			items.push({
				kind: 'folder',
				key: `f${folderId}`,
				folder,
				comics: [...list].sort(readingOrder),
			});
		} else {
			loose.push(...list);
		}
	}
	for (const c of loose) {
		items.push({ kind: 'comic', key: `c${c.id}`, comic: c });
	}
	const nameOf = (i: LibraryItem<C, F>) => (i.kind === 'folder' ? i.folder.name : i.comic.title);
	return items.sort((a, b) => naturalCompare(nameOf(a), nameOf(b)));
}

/** The comic to open from a folder: the one in progress, else the next unread, else the first. */
export function nextInFolder<C extends { progressPage: number | null; pageCount: number; lastOpenedAt: number | null }>(
	ordered: C[],
): C | undefined {
	const finished = (c: C) => c.progressPage !== null && c.pageCount > 0 && c.progressPage >= c.pageCount - 1;
	const inProgress = ordered
		.filter(c => c.progressPage !== null && !finished(c))
		.sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0));
	if (inProgress.length) {
		return inProgress[0];
	}
	const lastFinished = ordered.map(finished).lastIndexOf(true);
	return ordered.slice(lastFinished + 1).find(c => !finished(c)) ?? ordered[0];
}
