import type { Rotation } from '../../db/comics';
import type { ReadingDirection, WideMode } from '../../storage/settings';

/** Which part of a wide page is on screen. `first` and `second` follow reading order. */
export type Part = 'first' | 'second' | 'whole';

export type Position = { index: number; part: Part };

export type PageShape = { width: number | null; height: number | null };

export function isSpread(page: PageShape | undefined, threshold: number) {
	return !!page?.width && !!page.height && page.width / page.height >= threshold;
}

/** Wide pages are shown a half at a time unless rotated or set to show whole. */
export function usesHalves(spread: boolean, rotation: Rotation, wideMode: WideMode) {
	return spread && rotation === 0 && (wideMode === 'zoom' || wideMode === 'split');
}

/** Rotation for a page: the saved one, else 90° for spreads when auto-rotate is on. */
export function effectiveRotation(saved: Rotation | undefined, spread: boolean, wideMode: WideMode): Rotation {
	if (saved !== undefined) {
		return saved;
	}
	return spread && wideMode === 'rotate' ? 90 : 0;
}

export type Navigator = {
	count: number;
	halves: (index: number) => boolean;
};

export function nextPosition(pos: Position, nav: Navigator): Position | null {
	if (nav.halves(pos.index) && pos.part === 'first') {
		return { index: pos.index, part: 'second' };
	}
	if (pos.index + 1 >= nav.count) {
		return null;
	}
	return { index: pos.index + 1, part: nav.halves(pos.index + 1) ? 'first' : 'whole' };
}

export function previousPosition(pos: Position, nav: Navigator): Position | null {
	if (nav.halves(pos.index) && pos.part === 'second') {
		return { index: pos.index, part: 'first' };
	}
	if (pos.index === 0) {
		return null;
	}
	// stepping back lands on the half read last
	return { index: pos.index - 1, part: nav.halves(pos.index - 1) ? 'second' : 'whole' };
}

/** Maps reading-order halves to screen sides; right-to-left starts on the right. */
export function screenSide(part: Part, direction: ReadingDirection): 'left' | 'right' | 'whole' {
	if (part === 'whole') {
		return 'whole';
	}
	const rtl = direction === 'rtl';
	return (part === 'first') !== rtl ? 'left' : 'right';
}

export type Fit = {
	/** size the image view is laid out at */
	width: number;
	height: number;
	/** transform applied on top of that layout to show the chosen part */
	scale: number;
	translateX: number;
};

/**
 * Lays a page out inside a [screenW]x[screenH] viewport.
 *
 * The image is laid out at the size the sharpest mode needs (half a spread filling the screen)
 * and scaled down for whole-page modes, so switching between halves and the whole spread is a
 * transform animation rather than a re-layout and re-decode.
 */
export function fitPage(
	imageW: number,
	imageH: number,
	screenW: number,
	screenH: number,
	rotation: Rotation,
	side: 'left' | 'right' | 'whole',
	halvesPossible: boolean,
): Fit {
	const sideways = rotation === 90 || rotation === 270;
	const rw = sideways ? imageH : imageW;
	const rh = sideways ? imageW : imageH;
	const wholeScale = Math.min(screenW / rw, screenH / rh);
	const halfScale = Math.min(screenW / (imageW / 2), screenH / imageH);
	const layoutScale = halvesPossible ? Math.max(halfScale, wholeScale) : wholeScale;
	const width = imageW * layoutScale;
	const height = imageH * layoutScale;
	if (side === 'whole' || rotation !== 0) {
		return { width, height, scale: wholeScale / layoutScale, translateX: 0 };
	}
	const shown = (imageW * halfScale) / 4;
	return {
		width,
		height,
		scale: halfScale / layoutScale,
		translateX: side === 'left' ? shown : -shown,
	};
}
