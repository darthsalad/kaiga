import type { ComicInfo } from '../src/native/kaiga';
import { buildMetadata, displayTitle, issueOrder, parseFileName, titleForFile } from '../src/utils/metadata';
import { naturalCompare } from '../src/utils/naturalSort';

const info = (fields: Partial<ComicInfo>): ComicInfo => ({
	title: '',
	series: '',
	number: '',
	count: '',
	volume: '',
	year: '',
	month: '',
	summary: '',
	notes: '',
	writer: '',
	penciller: '',
	inker: '',
	coverArtist: '',
	publisher: '',
	genre: '',
	manga: '',
	languageIso: '',
	...fields,
});

test('scene-style names give series, issue, count and year', () => {
	expect(
		parseFileName('Green Lantern Corps - Recharge 01 (of 05) (2005) (digital) (Son of Ultron-Empire).cbr'),
	).toEqual({
		name: 'Green Lantern Corps - Recharge 01',
		series: 'Green Lantern Corps - Recharge',
		issueNumber: '1',
		issueCount: 5,
		volume: null,
		year: 2005,
	});
	expect(parseFileName('Saga #054 (2018).cbz')).toMatchObject({ series: 'Saga', issueNumber: '54', year: 2018 });
	expect(parseFileName('Batman_v2_012.cbz')).toMatchObject({ series: 'Batman', volume: 2, issueNumber: '12' });
	expect(parseFileName('Invincible 1.5.cbz')).toMatchObject({ series: 'Invincible', issueNumber: '1.5' });
});

test('names without an issue number keep their title', () => {
	const file = 'Green Lantern - Rebirth Deluxe Edition (2019) (digital) (Son of Ultron-Empire).cbr';
	expect(parseFileName(file)).toMatchObject({ series: null, issueNumber: null, year: 2019 });
	expect(titleForFile(file)).toBe('Green Lantern - Rebirth Deluxe Edition');
	// a trailing year is part of the name, not issue 1989
	expect(parseFileName('Batman 1989.cbz')).toMatchObject({ series: null, issueNumber: null });
	expect(titleForFile('Recharge 03 (of 05) (2006).cbr')).toBe('Recharge #3');
});

test('ComicInfo wins over the file name, which fills the gaps', () => {
	const meta = buildMetadata(
		info({
			series: 'Green Lantern: Rebirth Deluxe Edition',
			summary: 'Former Green Lantern Hal Jordan…',
			notes: 'Scraped metadata from Comixology [CMXDB822751], [RELDATE:2019-12-17]',
			publisher: 'DC',
			genre: 'Superhero',
		}),
		'Green Lantern - Rebirth Deluxe Edition (2019) (digital) (Son of Ultron-Empire).cbr',
	);
	expect(meta).toMatchObject({
		series: 'Green Lantern: Rebirth Deluxe Edition',
		issueNumber: null,
		year: 2019,
		publisher: 'DC',
		genre: 'Superhero',
		writer: null,
		readingDirection: null,
	});
	expect(displayTitle(meta, 'x.cbr')).toBe('Green Lantern: Rebirth Deluxe Edition');
});

test('manga marked right-to-left, credits are de-duplicated', () => {
	const meta = buildMetadata(
		info({ number: '007', manga: 'YesAndRightToLeft', writer: 'A, B', penciller: '', inker: 'C' }),
		'One Piece 007.cbz',
	);
	expect(meta).toMatchObject({
		series: 'One Piece',
		issueNumber: '7',
		readingDirection: 'rtl',
		writer: 'A, B',
		artist: 'C',
	});
});

test('folders read in issue order, falling back to file names', () => {
	const c = (issueNumber: string | null, sourceName: string) => ({ issueNumber, sourceName });
	expect([c('10', 'a'), c('2', 'b')].sort((a, b) => issueOrder(a, b, naturalCompare)).map(x => x.issueNumber)).toEqual([
		'2',
		'10',
	]);
	expect([c('2', 'b'), c(null, 'a')].sort((a, b) => issueOrder(a, b, naturalCompare)).map(x => x.sourceName)).toEqual([
		'a',
		'b',
	]);
});
