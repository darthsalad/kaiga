import { Kaiga } from '../native/kaiga';

const dirs = Kaiga.getDirs();

export const paths = {
	archivesDir: `${dirs.files}/archives`,
	coversDir: `${dirs.files}/covers`,
	pagesRoot: `${dirs.cache}/pages`,

	/** The archive keeps no extension: its format comes from its magic bytes. */
	archive: (comicId: number) => `${dirs.files}/archives/${comicId}.archive`,
	cover: (comicId: number) => `${dirs.files}/covers/${comicId}.webp`,
	pagesDir: (comicId: number) => `${dirs.cache}/pages/${comicId}`,
	page: (comicId: number, index: number, entryName: string) =>
		`${dirs.cache}/pages/${comicId}/${String(index).padStart(4, '0')}${extension(entryName)}`,
};

export function fileUri(path: string, version?: number | string) {
	return version === undefined ? `file://${path}` : `file://${path}?v=${version}`;
}

function extension(name: string) {
	const dot = name.lastIndexOf('.');
	return dot > name.lastIndexOf('/') ? name.slice(dot).toLowerCase() : '';
}
