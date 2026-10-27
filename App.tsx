import React, { useEffect, useState } from 'react';
import { AppState, StatusBar, View } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme as NavTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { SheetHost } from './src/components/Sheet';
import { SnackbarHost } from './src/components/Snackbar';
import { Text } from './src/components/Text';
import { migrate } from './src/db/database';
import { Kaiga, errorMessage } from './src/native/kaiga';
import { RootNavigator } from './src/navigation/RootNavigator';
import { scanAllRoots } from './src/services/folders';
import { resumeInterruptedImports, runCleanup } from './src/services/library';
import { ThemeProvider, useTheme } from './src/theme/ThemeProvider';

function Shell() {
	const theme = useTheme();
	const [ready, setReady] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		migrate()
			.then(() => {
				setReady(true);
				resumeInterruptedImports().then(() => scanAllRoots().catch(() => undefined));
				runCleanup();
			})
			.catch(err => setError(errorMessage(err)));
	}, []);

	useEffect(() => {
		if (ready || error) {
			// the launch screen stays up until the first real screen has been drawn
			requestAnimationFrame(() => Kaiga.hideSplash());
		}
	}, [ready, error]);

	useEffect(() => {
		const sub = AppState.addEventListener('change', state => {
			if (state === 'active' && ready) {
				runCleanup();
			}
		});
		return () => sub.remove();
	}, [ready]);

	const navTheme: NavTheme = {
		...(theme.dark ? DarkTheme : DefaultTheme),
		colors: {
			...(theme.dark ? DarkTheme : DefaultTheme).colors,
			background: theme.background,
			card: theme.surface,
			text: theme.text,
			primary: theme.accent.primary,
			border: theme.outlineVariant,
		},
	};

	return (
		<View style={{ flex: 1, backgroundColor: theme.background }}>
			<StatusBar barStyle={theme.dark ? 'light-content' : 'dark-content'} />
			{error ? (
				<View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
					<Text variant="title">Kaiga could not open its library</Text>
					<Text variant="caption" muted>
						{error}
					</Text>
				</View>
			) : ready ? (
				<ErrorBoundary>
					<NavigationContainer theme={navTheme}>
						<SheetHost>
							<RootNavigator />
						</SheetHost>
						<SnackbarHost />
					</NavigationContainer>
				</ErrorBoundary>
			) : null}
		</View>
	);
}

export default function App() {
	return (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<SafeAreaProvider>
				<ThemeProvider>
					<Shell />
				</ThemeProvider>
			</SafeAreaProvider>
		</GestureHandlerRootView>
	);
}
