import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Button } from './Controls';
import { Text } from './Text';

type State = { error: Error | null };

/**
 * Catches render errors anywhere below it and shows a screen to recover from, instead of the
 * app closing. Trying again remounts everything below, so the app starts over at the library.
 */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
	override state: State = { error: null };

	static getDerivedStateFromError(error: Error): State {
		return { error };
	}

	override componentDidCatch(error: Error, info: React.ErrorInfo) {
		console.error('Kaiga crashed', error, info.componentStack);
	}

	override render() {
		if (this.state.error) {
			return <CrashScreen error={this.state.error} onRetry={() => this.setState({ error: null })} />;
		}
		return this.props.children;
	}
}

function CrashScreen({ error, onRetry }: { error: Error; onRetry: () => void }) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	return (
		<View style={[styles.screen, { backgroundColor: theme.background, paddingTop: insets.top + 24 }]}>
			<Text variant="headline">Something went wrong</Text>
			<Text variant="body" muted>
				Kaiga hit an error and stopped this screen. Your library, progress and files are safe.
			</Text>
			<ScrollView style={[styles.details, { backgroundColor: theme.surface }]}>
				<Text variant="caption" selectable>
					{error.message || String(error)}
				</Text>
			</ScrollView>
			<Button label="Back to the library" onPress={onRetry} />
			<Text variant="caption" muted style={{ paddingBottom: insets.bottom + 16 }}>
				If this keeps happening, report it with the text above on the project's GitHub issues.
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
		paddingHorizontal: 24,
		gap: 16,
	},
	details: {
		flexGrow: 0,
		maxHeight: 240,
		borderRadius: 16,
		padding: 16,
	},
});
