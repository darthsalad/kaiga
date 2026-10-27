import type { Comic } from '../db/comics';

export function formatLabel(format: string | null) {
	switch (format) {
		case 'zip':
			return 'CBZ';
		case 'rar':
			return 'CBR';
		case '7z':
			return 'CB7';
		default:
			return null;
	}
}

export function isFinished(comic: Comic) {
	return comic.progressPage !== null && comic.pageCount > 0 && comic.progressPage >= comic.pageCount - 1;
}

/** The one-line status under a cover. */
export function comicStatus(comic: Comic, downloadProgress: number | undefined) {
	if (downloadProgress !== undefined) {
		return `Downloading · ${Math.round(downloadProgress * 100)}%`;
	}
	switch (comic.localState) {
		case 'queued':
			return comic.storage === 'direct' ? 'Preparing' : 'Waiting to download';
		case 'downloading':
			return 'Downloading';
		case 'error':
			return "Couldn't open";
		case 'unavailable':
			return 'File access lost';
		case 'evicted':
			return `On ${comic.sourceLabel ?? 'source'} · tap to fetch`;
		case 'ready':
			break;
	}
	const format = formatLabel(comic.format);
	if (isFinished(comic)) {
		return format ? `Finished · ${format}` : 'Finished';
	}
	if (comic.progressPage !== null) {
		return `Page ${comic.progressPage + 1} / ${comic.pageCount}`;
	}
	if (comic.keepOffline) {
		return format ? `Kept offline · ${format}` : 'Kept offline';
	}
	return format ? `Unread · ${format}` : 'Unread';
}
