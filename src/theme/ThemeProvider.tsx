import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { Kaiga } from '../native/kaiga';
import { useSetting } from '../storage/settings';
import { darkPalette, lightPalette, type Palette } from './tokens';

export type Theme = Palette & { dark: boolean };

const ThemeContext = createContext<Theme>({ ...darkPalette, dark: true });

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
	const scheme = useColorScheme();
	const [mode] = useSetting('themeMode');
	const [dynamicColor] = useSetting('dynamicColor');

	const theme = useMemo<Theme>(() => {
		const dark = mode === 'system' ? scheme !== 'light' : mode === 'dark';
		const base = dark ? darkPalette : lightPalette;
		const wallpaper = dynamicColor ? Kaiga.getDynamicAccent() : null;
		if (!wallpaper) {
			return { ...base, dark };
		}
		return {
			...base,
			dark,
			accent: dark
				? {
						primary: wallpaper.primaryDark,
						onPrimary: wallpaper.onPrimaryDark,
						container: wallpaper.containerDark,
						onContainer: wallpaper.onContainerDark,
					}
				: {
						primary: wallpaper.primaryLight,
						onPrimary: wallpaper.onPrimaryLight,
						container: wallpaper.containerLight,
						onContainer: wallpaper.onContainerLight,
					},
			inverseAccent: dark ? wallpaper.primaryLight : wallpaper.primaryDark,
		};
	}, [mode, scheme, dynamicColor]);

	return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}
