export type Accent = {
	primary: string;
	onPrimary: string;
	container: string;
	onContainer: string;
};

export type Palette = {
	background: string;
	surface: string;
	surfaceHigh: string;
	surfaceHighest: string;
	outline: string;
	outlineVariant: string;
	text: string;
	textMuted: string;
	textFaint: string;
	error: string;
	errorContainer: string;
	onErrorContainer: string;
	inverseSurface: string;
	onInverseSurface: string;
	scrim: string;
	accent: Accent;
	/** accent used on the inverse surface (snackbar actions) */
	inverseAccent: string;
};

/** Blue Material tones; replaced by the wallpaper's tones when dynamic colour is on. */
const blueDark: Accent = { primary: '#A9C7FF', onPrimary: '#0A2F5F', container: '#22406F', onContainer: '#D6E3FF' };
const blueLight: Accent = { primary: '#3D5F90', onPrimary: '#FFFFFF', container: '#D6E3FF', onContainer: '#001B3E' };

export const darkPalette: Palette = {
	background: '#101216',
	surface: '#191C22',
	surfaceHigh: '#22262E',
	surfaceHighest: '#2D323C',
	outline: '#4A5160',
	outlineVariant: '#2A2F38',
	text: '#E7E9EF',
	textMuted: '#A3A9B6',
	textFaint: '#8C93A0',
	error: '#FFB4AB',
	errorContainer: '#93000A',
	onErrorContainer: '#FFDAD6',
	inverseSurface: '#E2E2E9',
	onInverseSurface: '#2E3036',
	scrim: 'rgba(0,0,0,0.55)',
	accent: blueDark,
	inverseAccent: blueLight.primary,
};

export const lightPalette: Palette = {
	background: '#F9F9FF',
	surface: '#F0F1F7',
	surfaceHigh: '#E6E8EF',
	surfaceHighest: '#DCDEE6',
	outline: '#737885',
	outlineVariant: '#C3C6D2',
	text: '#191C21',
	textMuted: '#444852',
	textFaint: '#5D626D',
	error: '#BA1A1A',
	errorContainer: '#FFDAD6',
	onErrorContainer: '#410002',
	inverseSurface: '#2E3036',
	onInverseSurface: '#EFF0F7',
	scrim: 'rgba(0,0,0,0.4)',
	accent: blueLight,
	inverseAccent: blueDark.primary,
};

/** Google Sans Flex, the Material 3 Expressive typeface (OFL). One file per weight for Android. */
export const fonts = {
	regular: 'GoogleSansFlex-Regular',
	medium: 'GoogleSansFlex-Medium',
	semibold: 'GoogleSansFlex-SemiBold',
	bold: 'GoogleSansFlex-Bold',
	display: 'GoogleSansFlex-ExtraBold',
};

export const radius = {
	sm: 8,
	md: 12,
	lg: 18,
	xl: 20,
	xxl: 28,
	pill: 999,
};
