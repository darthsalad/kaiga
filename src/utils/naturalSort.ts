const chunk = /(\d+|\D+)/g;

/** Compares one path segment, treating digit runs as numbers: `page2` < `page10`. */
function compareSegment(a: string, b: string) {
	const ca = a.toLowerCase().match(chunk) ?? [];
	const cb = b.toLowerCase().match(chunk) ?? [];
	for (let i = 0; i < Math.min(ca.length, cb.length); i++) {
		const x = ca[i];
		const y = cb[i];
		if (x === y) {
			continue;
		}
		const xNum = /^\d/.test(x);
		const yNum = /^\d/.test(y);
		if (xNum && yNum) {
			const diff = Number(x) - Number(y);
			if (diff !== 0) {
				return diff;
			}
			// "01" vs "1": shorter (fewer leading zeros) first, so the order is still total
			return x.length - y.length;
		}
		return x < y ? -1 : 1;
	}
	return ca.length - cb.length;
}

/** Orders `page2.jpg` before `page10.jpg`, and folder by folder. */
export function naturalCompare(a: string, b: string) {
	const pa = a.split('/');
	const pb = b.split('/');
	for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
		// a file sorts before a sub-folder at the same level
		const aIsDir = i < pa.length - 1;
		const bIsDir = i < pb.length - 1;
		if (aIsDir !== bIsDir) {
			return aIsDir ? 1 : -1;
		}
		const c = compareSegment(pa[i], pb[i]);
		if (c !== 0) {
			return c;
		}
	}
	return pa.length - pb.length;
}
