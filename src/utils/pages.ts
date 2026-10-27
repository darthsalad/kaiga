import { naturalCompare } from './naturalSort';

const IMAGE = /\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|jxl)$/i;

/** Image entries in reading order, skipping macOS metadata and hidden files. */
export function pageEntries(names: string[]) {
	return names
		.filter(n => IMAGE.test(n))
		.filter(n => !n.split('/').some(part => part.startsWith('.') || part === '__MACOSX'))
		.sort(naturalCompare);
}
