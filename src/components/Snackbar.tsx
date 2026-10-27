import React, { useEffect, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Snack = { id: number; message: string; action?: { label: string; onPress: () => void }; onDismiss?: () => void };

let current: Snack | null = null;
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach(l => l());

/**
 * Shows a message at the bottom of the screen for a few seconds. [onDismiss] runs when it goes
 * away without its action being pressed, which is how undo-able deletes commit.
 */
export function showSnackbar(message: string, action?: Snack['action'], onDismiss?: () => void) {
	current?.onDismiss?.();
	current = { id: nextId++, message, action, onDismiss };
	emit();
}

function dismiss(id: number, viaAction: boolean) {
	if (current?.id !== id) {
		return;
	}
	const snack = current;
	current = null;
	emit();
	if (!viaAction) {
		snack.onDismiss?.();
	}
}

export function SnackbarHost({ bottomOffset = 96 }: { bottomOffset?: number }) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const snack = useSyncExternalStore(
		l => {
			listeners.add(l);
			return () => listeners.delete(l);
		},
		() => current,
	);

	useEffect(() => {
		if (!snack) {
			return;
		}
		const timer = setTimeout(() => dismiss(snack.id, false), 5000);
		return () => clearTimeout(timer);
	}, [snack]);

	if (!snack) {
		return null;
	}
	return (
		<Animated.View
			key={snack.id}
			entering={FadeInDown.duration(180)}
			exiting={FadeOutDown.duration(150)}
			pointerEvents="box-none"
			style={[styles.wrap, { bottom: bottomOffset + insets.bottom }]}>
			<View accessibilityRole="alert" style={[styles.snack, { backgroundColor: theme.inverseSurface }]}>
				<Text variant="body" weight="regular" color={theme.onInverseSurface} style={styles.message}>
					{snack.message}
				</Text>
				{snack.action && (
					<Pressable
						accessibilityRole="button"
						onPress={() => {
							snack.action!.onPress();
							dismiss(snack.id, true);
						}}
						style={styles.action}>
						<Text variant="body" weight="bold" color={theme.inverseAccent}>
							{snack.action.label}
						</Text>
					</Pressable>
				)}
			</View>
		</Animated.View>
	);
}

const styles = StyleSheet.create({
	wrap: {
		position: 'absolute',
		left: 16,
		right: 16,
	},
	snack: {
		minHeight: 48,
		borderRadius: 12,
		paddingLeft: 16,
		paddingRight: 8,
		paddingVertical: 4,
		flexDirection: 'row',
		alignItems: 'center',
		elevation: 6,
	},
	message: {
		flex: 1,
		paddingVertical: 8,
	},
	action: {
		height: 40,
		paddingHorizontal: 12,
		justifyContent: 'center',
	},
});
