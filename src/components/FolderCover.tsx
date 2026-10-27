import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Folder } from 'lucide-react-native';
import type { Comic } from '../db/comics';
import { useTheme } from '../theme/ThemeProvider';
import { Cover } from './Cover';
import { Text } from './Text';

/** A folder drawn as a small stack of its first covers, with a count badge. */
export function FolderCover({ comics, width, count }: { comics: Comic[]; width: number; count: number }) {
	const theme = useTheme();
	const front = comics[0];
	const behind = comics.slice(1, 3);
	const height = width * 1.5;
	const inset = width * 0.07;
	return (
		<View style={{ width, height }}>
			{behind
				.map((c, i) => (
					<View
						key={c.id}
						style={[
							styles.layer,
							{
								left: inset * (i + 1) + inset,
								right: -inset * (i + 0.2),
								top: -inset * (i + 0.4),
								bottom: inset * (i + 1.2),
								opacity: i === 0 ? 0.8 : 0.5,
							},
						]}>
						<Cover comic={c} width={width - inset * 2} radius={12} badges={false} />
					</View>
				))
				.reverse()}
			{front && (
				<View style={[styles.front, { top: inset * 0.6 }]}>
					<Cover comic={front} width={width - inset * 1.4} radius={12} badges={false} />
				</View>
			)}
			<View style={[styles.badge, { backgroundColor: theme.accent.primary }]} accessibilityLabel={`${count} comics`}>
				<Folder size={12} color={theme.accent.onPrimary} strokeWidth={2.6} />
				<Text variant="caption" weight="bold" color={theme.accent.onPrimary}>
					{count}
				</Text>
			</View>
		</View>
	);
}

const styles = StyleSheet.create({
	layer: {
		position: 'absolute',
		overflow: 'hidden',
		borderRadius: 12,
	},
	front: {
		position: 'absolute',
		left: 0,
		elevation: 4,
		borderRadius: 12,
	},
	badge: {
		position: 'absolute',
		right: 0,
		bottom: 4,
		minWidth: 28,
		height: 26,
		paddingHorizontal: 8,
		borderRadius: 13,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
		elevation: 5,
	},
});
