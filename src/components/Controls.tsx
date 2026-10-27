import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';
import { Text } from './Text';

export function Switch({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
	const theme = useTheme();
	const t = useSharedValue(value ? 1 : 0);
	useEffect(() => {
		t.value = withTiming(value ? 1 : 0, { duration: 160 });
	}, [value, t]);
	const knob = useAnimatedStyle(() => ({
		width: 16 + 8 * t.value,
		height: 16 + 8 * t.value,
		borderRadius: 12,
		transform: [{ translateX: 4 + 18 * t.value }],
	}));
	return (
		<Pressable
			accessibilityRole="switch"
			accessibilityLabel={label}
			accessibilityState={{ checked: value }}
			onPress={() => onChange(!value)}
			hitSlop={6}
			style={[
				styles.track,
				value
					? { backgroundColor: theme.accent.primary, borderColor: theme.accent.primary }
					: { backgroundColor: theme.surfaceHigh, borderColor: theme.textFaint },
			]}>
			<Animated.View style={[knob, { backgroundColor: value ? theme.accent.onPrimary : theme.textFaint }]} />
		</Pressable>
	);
}

export function Chip({
	label,
	selected,
	onPress,
	trailing,
	dashed,
	accessibilityLabel,
}: {
	label: string;
	selected?: boolean;
	onPress?: () => void;
	trailing?: React.ReactNode;
	dashed?: boolean;
	accessibilityLabel?: string;
}) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? label}
			accessibilityState={{ selected }}
			onPress={onPress}
			style={[
				styles.chip,
				selected
					? { backgroundColor: theme.accent.container, borderColor: theme.accent.container }
					: { borderColor: theme.outline, borderStyle: dashed ? 'dashed' : 'solid' },
			]}>
			<Text variant="label" color={selected ? theme.accent.onContainer : dashed ? theme.accent.primary : theme.text}>
				{label}
			</Text>
			{trailing}
		</Pressable>
	);
}

export function Segmented<T extends string | number>({
	options,
	value,
	onChange,
	style,
}: {
	options: { value: T; label: string }[];
	value: T;
	onChange: (v: T) => void;
	style?: StyleProp<ViewStyle>;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.segmented, { borderColor: theme.outline }, style]} accessibilityRole="radiogroup">
			{options.map((o, i) => {
				const on = o.value === value;
				return (
					<Pressable
						key={String(o.value)}
						accessibilityRole="radio"
						accessibilityState={{ checked: on }}
						onPress={() => onChange(o.value)}
						style={[
							styles.segment,
							i > 0 && { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: theme.outline },
							on && { backgroundColor: theme.accent.container },
						]}>
						<Text variant="label" color={on ? theme.accent.onContainer : theme.text} numberOfLines={1}>
							{o.label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

export function ProgressBar({ value, buffer, height = 4 }: { value: number; buffer?: number; height?: number }) {
	const theme = useTheme();
	return (
		<View style={[styles.bar, { height, borderRadius: height / 2, backgroundColor: theme.surfaceHighest }]}>
			{buffer !== undefined && (
				<View
					style={[StyleSheet.absoluteFill, { width: `${Math.min(1, buffer) * 100}%`, backgroundColor: theme.outline }]}
				/>
			)}
			<View
				style={[
					StyleSheet.absoluteFill,
					{ width: `${Math.min(1, value) * 100}%`, borderRadius: height / 2, backgroundColor: theme.accent.primary },
				]}
			/>
		</View>
	);
}

export function Button({
	label,
	onPress,
	icon,
	variant = 'filled',
	color,
}: {
	label: string;
	onPress: () => void;
	icon?: React.ReactNode;
	variant?: 'filled' | 'tonal' | 'outline';
	color?: string;
}) {
	const theme = useTheme();
	const bg = variant === 'filled' ? theme.accent.primary : variant === 'tonal' ? theme.accent.container : 'transparent';
	const fg =
		color ??
		(variant === 'filled' ? theme.accent.onPrimary : variant === 'tonal' ? theme.accent.onContainer : theme.text);
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			android_ripple={{ color: theme.surfaceHighest }}
			style={[
				styles.button,
				{ backgroundColor: bg },
				variant === 'outline' && { borderWidth: 1, borderColor: theme.outline },
			]}>
			{icon}
			<Text variant="title" color={fg}>
				{label}
			</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	track: {
		width: 52,
		height: 32,
		borderRadius: 16,
		borderWidth: 2,
		justifyContent: 'center',
	},
	chip: {
		height: 34,
		paddingHorizontal: 14,
		borderRadius: 10,
		borderWidth: 1,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	segmented: {
		flexDirection: 'row',
		borderWidth: 1,
		borderRadius: 22,
		overflow: 'hidden',
	},
	segment: {
		flex: 1,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
		paddingHorizontal: 6,
	},
	bar: {
		overflow: 'hidden',
		flexGrow: 1,
	},
	button: {
		height: 52,
		borderRadius: radius.pill,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
		paddingHorizontal: 20,
		overflow: 'hidden',
	},
});
