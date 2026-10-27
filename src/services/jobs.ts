import { useSyncExternalStore } from 'react';
import { Kaiga } from '../native/kaiga';

/** Live download progress per comic, 0..1. Lives in memory only; the DB holds the durable state. */
const progress = new Map<number, number>();
const listeners = new Set<() => void>();
const jobComic = new Map<string, number>();

function emit() {
	listeners.forEach(l => l());
}

export function downloadJobId(comicId: number) {
	return `dl-${comicId}`;
}

export function trackDownload(comicId: number) {
	jobComic.set(downloadJobId(comicId), comicId);
	progress.set(comicId, 0);
	emit();
}

export function finishDownload(comicId: number) {
	jobComic.delete(downloadJobId(comicId));
	progress.delete(comicId);
	emit();
}

Kaiga.onCopyProgress(({ jobId, bytes, total }) => {
	const comicId = jobComic.get(jobId);
	if (comicId === undefined) {
		return;
	}
	progress.set(comicId, total > 0 ? Math.min(1, bytes / total) : 0);
	emit();
});

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Download progress for a comic, or undefined when nothing is downloading. */
export function useDownloadProgress(comicId: number | undefined) {
	return useSyncExternalStore(subscribe, () => (comicId === undefined ? undefined : progress.get(comicId)));
}
