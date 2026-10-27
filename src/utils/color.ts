/** Relative luminance of a #RRGGBB colour (WCAG). */
export function luminance(hex: string) {
	const n = parseInt(hex.replace('#', ''), 16);
	const channel = (c: number) => {
		const v = c / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/** White or near-black, whichever reads better on [background]. */
export function readableOn(background: string) {
	const l = luminance(background);
	const onWhite = 1.05 / (l + 0.05);
	const onDark = (l + 0.05) / (luminance('#101216') + 0.05);
	return onWhite >= onDark ? '#FFFFFF' : '#101216';
}
