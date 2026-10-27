import {
	effectiveRotation,
	fitPage,
	isSpread,
	nextPosition,
	previousPosition,
	screenSide,
	usesHalves,
	type Navigator,
} from '../src/features/reader/layout';

// pages 0 and 2 are single, page 1 is a two-page spread
const nav: Navigator = { count: 3, halves: i => i === 1 };

test('a spread is read first half, second half, then the next page', () => {
	expect(nextPosition({ index: 0, part: 'whole' }, nav)).toEqual({ index: 1, part: 'first' });
	expect(nextPosition({ index: 1, part: 'first' }, nav)).toEqual({ index: 1, part: 'second' });
	expect(nextPosition({ index: 1, part: 'second' }, nav)).toEqual({ index: 2, part: 'whole' });
	expect(nextPosition({ index: 2, part: 'whole' }, nav)).toBeNull();
});

test('going back lands on the half read last', () => {
	expect(previousPosition({ index: 2, part: 'whole' }, nav)).toEqual({ index: 1, part: 'second' });
	expect(previousPosition({ index: 1, part: 'second' }, nav)).toEqual({ index: 1, part: 'first' });
	expect(previousPosition({ index: 1, part: 'first' }, nav)).toEqual({ index: 0, part: 'whole' });
	expect(previousPosition({ index: 0, part: 'whole' }, nav)).toBeNull();
});

test('right-to-left starts on the right half', () => {
	expect(screenSide('first', 'ltr')).toBe('left');
	expect(screenSide('second', 'ltr')).toBe('right');
	expect(screenSide('first', 'rtl')).toBe('right');
	expect(screenSide('whole', 'rtl')).toBe('whole');
});

test('spread detection uses the width / height threshold', () => {
	expect(isSpread({ width: 2000, height: 1400 }, 1.0)).toBe(true);
	expect(isSpread({ width: 1000, height: 1500 }, 1.0)).toBe(false);
	expect(isSpread({ width: null, height: null }, 1.0)).toBe(false);
});

test('rotation: saved wins, auto-rotate only for spreads, halves only unrotated', () => {
	expect(effectiveRotation(undefined, true, 'rotate')).toBe(90);
	expect(effectiveRotation(undefined, false, 'rotate')).toBe(0);
	expect(effectiveRotation(180, true, 'rotate')).toBe(180);
	expect(usesHalves(true, 0, 'zoom')).toBe(true);
	expect(usesHalves(true, 90, 'zoom')).toBe(false);
	expect(usesHalves(true, 0, 'whole')).toBe(false);
});

test('left half of a spread fills a portrait screen', () => {
	// 1.4:1 spread on a 390x844 screen: each half is 0.7:1 and fits the width
	const fit = fitPage(1400, 1000, 390, 844, 0, 'left', true);
	const half = (1400 / 2) * fit.scale * (fit.width / 1400);
	expect(half).toBeCloseTo(390);
	expect(fit.translateX).toBeCloseTo(390 / 2);
	const right = fitPage(1400, 1000, 390, 844, 0, 'right', true);
	expect(right.translateX).toBeCloseTo(-390 / 2);
});

test('whole and rotated spreads fit inside the screen', () => {
	const whole = fitPage(1400, 1000, 390, 844, 0, 'whole', true);
	expect(whole.width * whole.scale).toBeCloseTo(390);
	const turned = fitPage(1400, 1000, 390, 844, 90, 'left', false);
	// rotated, the spread's height runs across the screen
	expect(turned.height * turned.scale).toBeCloseTo(390);
	expect(turned.width * turned.scale).toBeLessThanOrEqual(844);
	expect(turned.translateX).toBe(0);
});
