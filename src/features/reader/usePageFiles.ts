import { useEffect, useRef, useState } from 'react';
import { savePageSizes, type Page } from '../../db/comics';
import { errorCode, Kaiga } from '../../native/kaiga';
import { paths } from '../../storage/paths';

export type PageFile = { path: string; width: number; height: number };

/**
 * Extracts a comic's pages into the page cache, closest to [around] first, and reports each one
 * as soon as it is on disk. Pages already cached are reported immediately. Restarts with a new
 * priority when the reader jumps far away (scrubbing), since ZIP pages can be pulled in any order.
 */
export function usePageFiles(
	comicId: number,
	archive: string,
	pages: Page[] | undefined,
	archiveReady: boolean,
	around: number,
) {
	const [files, setFiles] = useState<Map<number, PageFile>>(() => new Map());
	const [failed, setFailed] = useState(false);
	const anchor = useRef(around);
	const [generation, setGeneration] = useState(0);

	// re-prioritise only on big jumps; small steps are covered by the running job
	useEffect(() => {
		if (Math.abs(around - anchor.current) > 4 && !files.has(around)) {
			anchor.current = around;
			setGeneration(g => g + 1);
		}
	}, [around, files]);

	useEffect(() => {
		if (!pages?.length || !archiveReady) {
			return;
		}
		const jobId = `pages-${comicId}-${generation}`;
		const byName = new Map(pages.map(p => [p.entryName, p]));
		const pendingSizes: { index: number; width: number; height: number }[] = [];
		const start = anchor.current;
		const order = [...pages].sort((a, b) => {
			const da = a.index >= start ? a.index - start : (start - a.index) * 2 + 1;
			const db = b.index >= start ? b.index - start : (start - b.index) * 2 + 1;
			return da - db;
		});

		const sub = Kaiga.onPageExtracted(e => {
			if (e.jobId !== jobId) {
				return;
			}
			const page = byName.get(e.name);
			if (!page) {
				return;
			}
			if (page.width !== e.width || page.height !== e.height) {
				pendingSizes.push({ index: page.index, width: e.width, height: e.height });
			}
			setFiles(prev => {
				const next = new Map(prev);
				next.set(page.index, { path: e.path, width: e.width, height: e.height });
				return next;
			});
		});

		Kaiga.extractEntries(
			jobId,
			archive,
			order.map(p => p.entryName),
			order.map(p => paths.page(comicId, p.index, p.entryName)),
		)
			.catch(err => {
				if (errorCode(err) !== 'E_CANCELLED') {
					setFailed(true);
				}
			})
			.finally(() => savePageSizes(comicId, pendingSizes.splice(0)));

		return () => {
			sub.remove();
			Kaiga.cancelJob(jobId);
			savePageSizes(comicId, pendingSizes.splice(0));
		};
	}, [comicId, archive, pages, archiveReady, generation]);

	return { files, failed };
}
