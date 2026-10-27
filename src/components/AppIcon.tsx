import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

/** The Panels mark (docs/branding/icon.svg): a K made of three comic panels. */
export function AppIcon({ size }: { size: number }) {
	return (
		<Svg width={size} height={size} viewBox="0 0 108 108" accessibilityLabel="Kaiga icon">
			<Rect width={108} height={108} rx={24} fill="#14161A" />
			<Rect x={29} y={27} width={17} height={54} rx={3.5} fill="#F2EDE4" />
			<Path d="M50 27 H81 L63 51.5 H50 Z" fill="#F4BD3C" stroke="#F4BD3C" strokeWidth={3} strokeLinejoin="round" />
			<Path d="M50 56.5 H63 L81 81 H50 Z" fill="#F2EDE4" stroke="#F2EDE4" strokeWidth={3} strokeLinejoin="round" />
		</Svg>
	);
}
