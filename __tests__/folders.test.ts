import {
	folderForPickedUri,
	folderForRootFile,
	groupLibrary,
	locationFromUri,
	nextInFolder,
} from '../src/utils/folders';

const doc = (path: string, volume = 'primary') =>
	`content://com.android.externalstorage.documents/document/${encodeURIComponent(`${volume}:${path}`)}`;

test('reads the path from phone storage and raw Downloads URIs', () => {
	expect(locationFromUri(doc('Download/GL Corps/01.cbr'))).toEqual({
		volume: 'primary',
		segments: ['Download', 'GL Corps', '01.cbr'],
	});
	expect(
		locationFromUri(
			`content://com.android.providers.downloads.documents/document/${encodeURIComponent('raw:/storage/emulated/0/Download/a/b.cbz')}`,
		),
	).toEqual({ volume: 'primary', segments: ['Download', 'a', 'b.cbz'] });
});

test('opaque ids (Drive, msf: downloads) reveal no folder', () => {
	expect(
		locationFromUri('content://com.google.android.apps.docs.storage/document/acc%3D1%3Bdoc%3Dencoded%3Dxyz'),
	).toBeNull();
	expect(locationFromUri('content://com.android.providers.downloads.documents/document/msf%3A1000123')).toBeNull();
});

test('picked files group by their parent folder, but not directly in Download', () => {
	expect(folderForPickedUri(doc('Download/GL Corps/01.cbr'))).toEqual({
		key: 'vol:primary|Download/GL Corps',
		name: 'GL Corps',
		location: 'Phone storage › Download',
	});
	expect(folderForPickedUri(doc('Download/single.cbz'))).toBeNull();
	expect(folderForPickedUri(doc('Comics/DC/GL Corps/01.cbr', '1A2B-3C4D'))?.location).toBe('SD card › Comics › DC');
});

test('watched folders group by sub-folder; files at the top stay loose', () => {
	expect(folderForRootFile(3, 'Comics', 'top.cbz')).toBeNull();
	expect(folderForRootFile(3, 'Comics', 'DC/Saga/01.cbz')).toEqual({
		key: 'root:3|DC/Saga',
		name: 'Saga',
		location: 'Comics › DC',
	});
});

const comic = (id: number, title: string, folderId: number | null, sourceName = `${title}.cbz`) => ({
	id,
	title,
	sourceName,
	folderId,
});

test('folders need two comics unless made by hand; members sort by file name', () => {
	const folders = [
		{ id: 1, name: 'GL Corps', manual: false },
		{ id: 2, name: 'Lonely', manual: false },
		{ id: 3, name: 'Mine', manual: true },
	];
	const items = groupLibrary(
		[
			comic(1, 'GL 10', 1, 'gl10.cbr'),
			comic(2, 'GL 2', 1, 'gl2.cbr'),
			comic(3, 'Alone', 2),
			comic(4, 'Pinned', 3),
			comic(5, 'Batman', null),
		],
		folders,
	);
	expect(items.map(i => (i.kind === 'folder' ? `F:${i.folder.name}` : `C:${i.comic.title}`))).toEqual([
		'C:Alone',
		'C:Batman',
		'F:GL Corps',
		'F:Mine',
	]);
	const gl = items.find(i => i.kind === 'folder' && i.folder.id === 1);
	expect(gl?.kind === 'folder' && gl.comics.map(c => c.id)).toEqual([2, 1]);
});

test('continue picks the issue in progress, else the next unread', () => {
	const c = (progressPage: number | null, lastOpenedAt: number | null = null) => ({
		progressPage,
		pageCount: 20,
		lastOpenedAt,
	});
	const finished = c(19, 1);
	const reading = c(5, 2);
	const unread = c(null);
	expect(nextInFolder([finished, reading, unread])).toBe(reading);
	expect(nextInFolder([finished, unread, c(null)])).toBe(unread);
	const all = [c(19), c(19)];
	expect(nextInFolder(all)).toBe(all[0]);
});
