import React, { useMemo, useRef } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Trash2 } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '../../components/Controls';
import { Cover } from '../../components/Cover';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import { history, removeFromHistory, restoreHistory, type Comic } from '../../db/comics';
import type { TabScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { formatTime, historyGroup } from '../../utils/format';
import { haptic } from '../../utils/haptics';
import { isFinished } from '../comicMeta';

const ACTION_WIDTH = 112;

export function HistoryScreen({ navigation }: TabScreenProps<'History'>) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { data } = useQuery(history, [], ['comics']);

	const sections = useMemo(() => {
		const groups = new Map<string, Comic[]>();
		for (const c of data ?? []) {
			const g = historyGroup(c.lastOpenedAt!);
			groups.set(g, [...(groups.get(g) ?? []), c]);
		}
		return [...groups.entries()].map(([title, items]) => ({ title, data: items }));
	}, [data]);

	const remove = async (comic: Comic) => {
		await removeFromHistory(comic.id);
		showSnackbar(`${comic.title} removed · progress reset`, {
			label: 'Undo',
			onPress: () => restoreHistory(comic.id, comic.progressPage, comic.lastOpenedAt),
		});
	};

	return (
		<View style={[styles.screen, { backgroundColor: theme.background }]}>
			<SectionList
				sections={sections}
				keyExtractor={c => String(c.id)}
				stickySectionHeadersEnabled={false}
				contentContainerStyle={{ paddingTop: insets.top + 8, paddingBottom: 120 }}
				ListHeaderComponent={
					<View style={styles.header}>
						<Text variant="display">History</Text>
						<Text variant="label" weight="regular" muted>
							Swipe left on a comic to remove it and reset its progress.
						</Text>
					</View>
				}
				ListEmptyComponent={
					data ? (
						<Text variant="body" weight="regular" muted style={styles.empty}>
							Comics you open show up here.
						</Text>
					) : undefined
				}
				renderSectionHeader={({ section }) => (
					<Text variant="label" weight="bold" color={theme.accent.primary} style={styles.sectionHead}>
						{section.title}
					</Text>
				)}
				renderItem={({ item }) => (
					<HistoryRow
						comic={item}
						onOpen={() => navigation.navigate('Reader', { comicId: item.id })}
						onDetails={() => navigation.navigate('Detail', { comicId: item.id })}
						onDelete={() => remove(item)}
					/>
				)}
			/>
		</View>
	);
}

function HistoryRow({
	comic,
	onOpen,
	onDetails,
	onDelete,
}: {
	comic: Comic;
	onOpen: () => void;
	onDetails: () => void;
	onDelete: () => void;
}) {
	const theme = useTheme();
	const ref = useRef<SwipeableMethods>(null);
	const page = (comic.progressPage ?? 0) + 1;
	const sub = isFinished(comic) ? 'Finished' : `Page ${page} of ${comic.pageCount}`;

	return (
		<Swipeable
			ref={ref}
			friction={1.5}
			rightThreshold={ACTION_WIDTH / 2}
			overshootRight={false}
			renderRightActions={() => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`Delete ${comic.title} from history and reset progress`}
					onPress={() => {
						ref.current?.close();
						onDelete();
					}}
					style={[styles.action, { backgroundColor: theme.errorContainer }]}>
					<Trash2 size={22} color={theme.onErrorContainer} />
					<Text variant="label" weight="bold" color={theme.onErrorContainer}>
						Delete
					</Text>
					<Text variant="caption" color={theme.onErrorContainer} style={styles.actionSub}>
						Resets progress
					</Text>
				</Pressable>
			)}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`${comic.title}, ${sub}`}
				accessibilityHint="Opens the reader. Long press for details."
				accessibilityActions={[{ name: 'delete', label: 'Remove from history' }]}
				onAccessibilityAction={e => e.nativeEvent.actionName === 'delete' && onDelete()}
				onPress={onOpen}
				onLongPress={() => {
					haptic('long');
					onDetails();
				}}
				android_ripple={{ color: theme.surfaceHigh }}
				style={[styles.row, { backgroundColor: theme.background }]}>
				<Cover comic={comic} width={48} radius={8} badges={false} />
				<View style={styles.info}>
					<View style={styles.titleRow}>
						<Text variant="body" weight="bold" numberOfLines={1} style={styles.flex}>
							{comic.title}
						</Text>
						<Text variant="caption" muted>
							{formatTime(comic.lastOpenedAt!)}
						</Text>
					</View>
					<Text variant="caption" muted>
						{sub}
					</Text>
					<View style={styles.bar}>
						<ProgressBar value={page / Math.max(1, comic.pageCount)} />
					</View>
				</View>
			</Pressable>
		</Swipeable>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 16,
		gap: 6,
		paddingBottom: 6,
	},
	sectionHead: {
		paddingHorizontal: 16,
		paddingTop: 18,
		paddingBottom: 6,
	},
	empty: {
		padding: 16,
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		paddingHorizontal: 16,
		paddingVertical: 10,
	},
	info: {
		flex: 1,
		gap: 6,
	},
	titleRow: {
		flexDirection: 'row',
		gap: 8,
		alignItems: 'baseline',
	},
	flex: {
		flex: 1,
	},
	bar: {
		flexDirection: 'row',
	},
	action: {
		width: ACTION_WIDTH,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 4,
	},
	actionSub: {
		fontSize: 10,
		opacity: 0.85,
	},
});
