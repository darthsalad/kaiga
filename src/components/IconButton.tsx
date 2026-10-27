import React from 'react';
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeProvider';

type Props = {
	icon: LucideIcon;
	label: string;
	onPress?: () => void;
	selected?: boolean;
	color?: string;
	fill?: string;
	size?: number;
	disabled?: boolean;
	style?: StyleProp<ViewStyle>;
};

export function IconButton({ icon: Icon, label, onPress, selected, color, fill, size = 22, disabled, style }: Props) {
	const theme = useTheme();
	const tint = selected ? theme.accent.onContainer : (color ?? theme.text);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={label}
			accessibilityState={{ selected, disabled }}
			onPress={onPress}
			disabled={disabled}
			hitSlop={4}
			android_ripple={{ color: theme.surfaceHighest, borderless: true, radius: 22 }}
			style={[
				styles.button,
				selected && { backgroundColor: theme.accent.container },
				disabled && styles.disabled,
				style,
			]}>
			<Icon size={size} color={tint} fill={fill ?? 'none'} strokeWidth={2} />
		</Pressable>
	);
}

const styles = StyleSheet.create({
	button: {
		width: 44,
		height: 44,
		borderRadius: 22,
		alignItems: 'center',
		justifyContent: 'center',
	},
	disabled: {
		opacity: 0.4,
	},
});
