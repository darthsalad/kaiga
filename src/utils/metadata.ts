import type { ComicInfo } from '../native/kaiga';
import type { ReadingDirection } from '../storage/settings';

/** Bump when metadata reading changes, so comics already in the library are read again. */
export const META_VERSION = 1;

export type Metadata = {
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
	/** only set when ComicInfo marks the comic as right-to-left manga */
	readingDirection: ReadingDirection | null;
};

export type FileNameInfo = {
	/** the name without extension and trailing tags such as (2005) or (digital) */
	name: string;
	series: string | null;
	issueNumber: string | null;
	issueCount: number | null;
	volume: number | null;
	year: number | null;
};

const YEAR = /^(19|20)\d{2}$/;

/** "01" and "001" are issue 1; "0" and "1.5" stay as they are. */
function normalizeNumber(n: string) {
	return n.replace(/^0+(?=\d)/, '');
}

function toInt(s: string | undefined) {
	const n = s ? parseInt(s, 10) : NaN;
	return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads what scene-style comic names carry, e.g.
 * "Green Lantern Corps - Recharge 01 (of 05) (2005) (digital) (Group).cbr".
 */
export function parseFileName(fileName: string): FileNameInfo {
	let base = fileName.replace(/\.(cbz|cbr|cb7|zip|rar|7z)$/i, '');
	// "Saga.012.2013" style names use dots for spaces; names with spaces keep their dots ("1.5")
	base = (base.includes(' ') ? base.replace(/_+/g, ' ') : base.replace(/[_.]+/g, ' ')).replace(/\s+/g, ' ').trim();

	const tags: string[] = [];
	let rest = base;
	for (let m = rest.match(/\s*[([]([^()[\]]*)[)\]]\s*$/); m; m = rest.match(/\s*[([]([^()[\]]*)[)\]]\s*$/)) {
		tags.unshift(m[1].trim());
		rest = rest.slice(0, m.index).trim();
	}
	rest = rest || base;

	const year = toInt(tags.find(t => YEAR.test(t)));
	const of = tags.map(t => t.match(/^of\s+(\d+)$/i)).find(Boolean);
	let issueCount = of ? toInt(of[1]) : null;

	let series: string | null = null;
	let issueNumber: string | null = null;
	let volume: number | null = null;
	// "Series 01", "Series #12", "Series 1.5", "Series 03 of 05"
	const issue = rest.match(/^(.*?)[\s-]+#?(\d+(?:\.\d+)?)(?:\s+of\s+(\d+))?$/i);
	// a bare trailing year ("Batman 1989") is part of the name, not an issue number
	if (issue && issue[1] && !(YEAR.test(issue[2]) && !rest.includes('#'))) {
		series = issue[1].replace(/[\s\-–:]+$/, '');
		issueNumber = normalizeNumber(issue[2]);
		issueCount = issueCount ?? toInt(issue[3]);
		const vol = series.match(/^(.*?)\s+v(?:ol(?:ume)?\.?\s*)?(\d+)$/i);
		if (vol) {
			series = vol[1];
			volume = toInt(vol[2]);
		}
	}
	return { name: rest, series, issueNumber, issueCount, volume, year };
}

function names(...values: string[]) {
	const all = values
		.flatMap(v => v.split(','))
		.map(v => v.trim())
		.filter(Boolean);
	return all.length ? [...new Set(all)].join(', ') : null;
}

/** ComicInfo wins where it has a value; the file name fills in the rest. */
export function buildMetadata(info: ComicInfo | null, fileName: string): Metadata {
	const file = parseFileName(fileName);
	const s = (v: string | undefined) => v?.trim() || null;
	const released = info?.notes.match(/RELDATE:(\d{4})/)?.[1];
	return {
		series: s(info?.series) ?? file.series,
		issueNumber: info?.number ? normalizeNumber(info.number.trim()) : file.issueNumber,
		issueCount: toInt(info?.count) ?? file.issueCount,
		volume: toInt(info?.volume) ?? file.volume,
		year: toInt(info?.year) ?? toInt(released) ?? file.year,
		summary: s(info?.summary),
		writer: info ? names(info.writer) : null,
		artist: info ? names(info.penciller || info.inker || info.coverArtist) : null,
		publisher: s(info?.publisher),
		genre: info ? names(info.genre) : null,
		readingDirection: info?.manga.toLowerCase() === 'yesandrighttoleft' ? 'rtl' : null,
	};
}

/** "Series #Number" when both are known, else the series, else the cleaned-up file name. */
export function displayTitle(meta: Pick<Metadata, 'series' | 'issueNumber'>, fileName: string) {
	if (meta.series && meta.issueNumber) {
		return `${meta.series} #${meta.issueNumber}`;
	}
	return meta.series ?? parseFileName(fileName).name;
}

/** The title a comic gets before its archive has been read. */
export function titleForFile(fileName: string) {
	return displayTitle(parseFileName(fileName), fileName);
}

/** Orders comics in a folder by issue number when both have one, else by file name. */
export function issueOrder(
	a: { issueNumber?: string | null; sourceName: string },
	b: { issueNumber?: string | null; sourceName: string },
	byName: (x: string, y: string) => number,
) {
	const na = a.issueNumber ? parseFloat(a.issueNumber) : NaN;
	const nb = b.issueNumber ? parseFloat(b.issueNumber) : NaN;
	if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) {
		return na - nb;
	}
	return byName(a.sourceName, b.sourceName);
}
