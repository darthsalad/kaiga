import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Segmented } from '../../components/Controls';
import { Sheet } from '../../components/Sheet';
import { Text } from '../../components/Text';
import type { Rotation } from '../../db/comics';
import type { ReadingDirection, WideMode } from '../../storage/settings';
import { useTheme } from '../../theme/ThemeProvider';

export const wideModes: { value: WideMode; label: string; sub: string }[] = [
	{ value: 'zoom', label: 'Zoom to first half', sub: 'Left half, then right. Right to left flips it.' },
	{ value: 'whole', label: 'Show whole spread', sub: 'Fit both pages on screen' },
	{ value: 'split', label: 'Split into two pages', sub: 'Each half counts as a page' },
	{ value: 'rotate', label: 'Rotate automatically', sub: 'Turn wide pages 90°' },
];

export const directions: { value: ReadingDirection; label: string }[] = [
	{ value: 'ltr', label: 'Left to right' },
	{ value: 'rtl', label: 'Right to left' },
	{ value: 'vertical', label: 'Vertical' },
];

type Props = {
	visible: boolean;
	onClose: () => void;
	rotation: Rotation;
	onRotation: (r: Rotation) => void;
	wideMode: WideMode;
	onWideMode: (m: WideMode) => void;
	direction: ReadingDirection;
	onDirection: (d: ReadingDirection) => void;
};

export function ReaderSheet(props: Props) {
	return (
		<Sheet visible={props.visible} onClose={props.onClose}>
			<View style={styles.section}>
				<View style={styles.head}>
					<Text variant="title">Rotate this page</Text>
					<Text variant="caption" muted>
						Remembered per page
					</Text>
				</View>
				<Segmented
					options={([0, 90, 180, 270] as Rotation[]).map(r => ({ value: r, label: `${r}°` }))}
					value={props.rotation}
					onChange={props.onRotation}
				/>
			</View>

			<View style={styles.section}>
				<Text variant="title">Wide pages</Text>
				<WideModePicker value={props.wideMode} onChange={props.onWideMode} />
			</View>

			<View style={styles.section}>
				<Text variant="title">Reading direction</Text>
				<Segmented options={directions} value={props.direction} onChange={props.onDirection} />
			</View>
		</Sheet>
	);
}

export function WideModePicker({ value, onChange }: { value: WideMode; onChange: (m: WideMode) => void }) {
	const theme = useTheme();
	return (
		<View accessibilityRole="radiogroup" style={styles.options}>
			{wideModes.map(m => {
				const on = m.value === value;
				return (
					<Pressable
						key={m.value}
						accessibilityRole="radio"
						accessibilityState={{ checked: on }}
						onPress={() => onChange(m.value)}
						style={[styles.option, on && { backgroundColor: theme.surfaceHigh }]}>
						<View
							style={[
								styles.radio,
								on ? { borderWidth: 6, borderColor: theme.accent.primary } : { borderColor: theme.textFaint },
							]}
						/>
						<View style={styles.flex}>
							<Text variant="body">{m.label}</Text>
							<Text variant="caption" muted>
								{m.sub}
							</Text>
						</View>
					</Pressable>
				);
			})}
		</View>
	);
}

const styles = StyleSheet.create({
	section: {
		gap: 10,
	},
	head: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'baseline',
	},
	options: {
		gap: 2,
	},
	option: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		paddingVertical: 10,
		paddingHorizontal: 12,
		borderRadius: 14,
	},
	radio: {
		width: 20,
		height: 20,
		borderRadius: 10,
		borderWidth: 2,
	},
	flex: {
		flex: 1,
	},
});
