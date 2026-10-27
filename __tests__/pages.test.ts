import { naturalCompare } from '../src/utils/naturalSort';
import { pageEntries } from '../src/utils/pages';

test('natural order puts page2 before page10', () => {
	expect(['p10.jpg', 'p2.jpg', 'p1.jpg'].sort(naturalCompare)).toEqual(['p1.jpg', 'p2.jpg', 'p10.jpg']);
});

test('files before sub-folders, folders in natural order', () => {
	const names = ['Ch10/01.jpg', 'Ch2/01.jpg', 'cover.jpg', 'Ch2/02.jpg'];
	expect(names.sort(naturalCompare)).toEqual(['cover.jpg', 'Ch2/01.jpg', 'Ch2/02.jpg', 'Ch10/01.jpg']);
});

test('page entries skip metadata, hidden files and non-images', () => {
	expect(
		pageEntries([
			'__MACOSX/._001.jpg',
			'.DS_Store',
			'ComicInfo.xml',
			'002.PNG',
			'001.jpg',
			'.hidden/003.jpg',
			'Thumbs.db',
			'004.webp',
		]),
	).toEqual(['001.jpg', '002.PNG', '004.webp']);
});
