import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { FilePlus, FolderPlus, Plus, Search } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Chip, ProgressBar } from '../../components/Controls';
import { Cover } from '../../components/Cover';
import { FolderCover } from '../../components/FolderCover';
import { Sheet } from '../../components/Sheet';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import { continueReading, libraryStats, listComics, type Comic, type LibraryFilter } from '../../db/comics';
import { allFolders, type Folder } from '../../db/folders';
import { allTags } from '../../db/tags';
import { errorMessage } from '../../native/kaiga';
import type { TabScreenProps } from '../../navigation/types';
import { useDownloadProgress } from '../../services/jobs';
import { addLibraryFolder, scanAllRoots, type ScanResult } from '../../services/folders';
import { pickAndImport } from '../../services/library';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius } from '../../theme/tokens';
import { formatBytes, formatRelative } from '../../utils/format';
import { groupLibrary, type LibraryItem } from '../../utils/folders';
import { haptic } from '../../utils/haptics';
import { comicStatus } from '../comicMeta';
import { ComicActions } from './ComicActions';

const GAP = 12;
const PADDING = 16;
/** covers never get narrower than this, so wide screens (landscape, tablets) fit more columns */
const MIN_COVER = 120;

type FilterChip = { key: string; label: string; filter: LibraryFilter };

const baseFilters: FilterChip[] = [
	{ key: 'all', label: 'All', filter: { kind: 'all' } },
	{ key: 'folders', label: 'Folders', filter: { kind: 'all' } },
	{ key: 'bookmarked', label: 'Bookmarked', filter: { kind: 'bookmarked' } },
	{ key: 'reading', label: 'Reading', filter: { kind: 'reading' } },
	{ key: 'onPhone', label: 'On phone', filter: { kind: 'onPhone' } },
];

export function LibraryScreen({ navigation }: TabScreenProps<'Library'>) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { width } = useWindowDimensions();
	const [search, setSearch] = useState('');
	const [filterKey, setFilterKey] = useState('all');

	const { data: tags } = useQuery(allTags, [], ['tags']);
	const filters = useMemo<FilterChip[]>(
		() => [
			...baseFilters,
			...(tags ?? []).map(t => ({
				key: `tag-${t.id}`,
				label: `#${t.name}`,
				filter: { kind: 'tag', tagId: t.id } as const,
			})),
		],
		[tags],
	);
	const active = filters.find(f => f.key === filterKey) ?? baseFilters[0];

	const { data: comics } = useQuery(() => listComics(active.filter, search), [active.key, search], ['comics', 'tags']);
	const { data: continuing } = useQuery(() => continueReading(), [], ['comics']);
	const { data: stats } = useQuery(libraryStats, [], ['comics']);
	const { data: folders } = useQuery(allFolders, [], ['folders']);

	// folders group the grid only when browsing everything; searches and filters list comics flat
	const grouped = (active.key === 'all' || active.key === 'folders') && !search;
	const items = useMemo<LibraryItem<Comic, Folder>[] | undefined>(() => {
		if (!comics) {
			return undefined;
		}
		if (!grouped) {
			return comics.map(c => ({ kind: 'comic', key: `c${c.id}`, comic: c }));
		}
		const all = groupLibrary(comics, folders ?? []);
		return active.key === 'folders' ? all.filter(i => i.kind === 'folder') : all;
	}, [comics, folders, grouped, active.key]);
	const folderItems = items?.filter(i => i.kind === 'folder').length ?? 0;
	const comicItems = (items?.length ?? 0) - folderItems;

	const [adding, setAdding] = useState(false);
	const [refreshing, setRefreshing] = useState(false);
	const reportScan = (r: ScanResult, prefix = '') => {
		const parts = [
			r.added && `${r.added} new`,
			r.returned && `${r.returned} back`,
			r.missing && `${r.missing} missing`,
		].filter(Boolean);
		if (parts.length || prefix) {
			showSnackbar(`${prefix}${parts.length ? parts.join(' · ') : 'Nothing new'}`);
		}
	};
	const refresh = async () => {
		setRefreshing(true);
		try {
			reportScan(await scanAllRoots());
		} catch (err) {
			showSnackbar(`Couldn't check folders: ${errorMessage(err)}`);
		} finally {
			setRefreshing(false);
		}
	};

	const columns = Math.max(3, Math.floor((width - PADDING * 2 + GAP) / (MIN_COVER + GAP)));
	const coverWidth = (width - PADDING * 2 - GAP * (columns - 1)) / columns;
	const open = useCallback((comic: Comic) => navigation.navigate('Detail', { comicId: comic.id }), [navigation]);
	const [menuComic, setMenuComic] = useState<Comic | null>(null);
	const openMenu = (c: Comic) => {
		haptic('long');
		setMenuComic(c);
	};

	const addFolder = async () => {
		setAdding(false);
		try {
			const r = await addLibraryFolder();
			reportScan(r, `${r.name}: `);
		} catch (err) {
			if (!(isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)) {
				showSnackbar(`Couldn't add the folder: ${errorMessage(err)}`);
			}
		}
	};

	const addComics = async () => {
		setAdding(false);
		try {
			const { added, skipped } = await pickAndImport();
			const parts = [];
			if (added > 0) {
				parts.push(added === 1 ? 'Adding 1 comic' : `Adding ${added} comics`);
			}
			if (skipped.length === 1) {
				parts.push(`${skipped[0]} is not a comic archive`);
			} else if (skipped.length > 1) {
				parts.push(`${skipped.length} files are not comic archives`);
			}
			if (parts.length) {
				showSnackbar(parts.join(' · '));
			}
		} catch (err) {
			if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
				return;
			}
			showSnackbar(`Couldn't add: ${errorMessage(err)}`);
		}
	};

	const isEmptyLibrary = stats?.count === 0;
	const header = (
		<View style={{ paddingTop: insets.top + 8 }}>
			<View style={styles.titleRow}>
				<Text variant="display">Library</Text>
			</View>

			<View style={[styles.search, { backgroundColor: theme.surfaceHigh }]}>
				<Search size={20} color={theme.textMuted} />
				<TextInput
					value={search}
					onChangeText={setSearch}
					placeholder="Search your comics"
					placeholderTextColor={theme.textMuted}
					accessibilityLabel="Search comics"
					style={[styles.searchInput, { color: theme.text }]}
					returnKeyType="search"
				/>
			</View>

			<ScrollView
				horizontal
				showsHorizontalScrollIndicator={false}
				contentContainerStyle={styles.chips}
				style={styles.chipRow}>
				{filters
					.filter(f => f.key !== 'folders' || !!folders?.length)
					.map(f => (
						<Chip key={f.key} label={f.label} selected={f.key === active.key} onPress={() => setFilterKey(f.key)} />
					))}
			</ScrollView>

			{!!continuing?.length && active.key === 'all' && !search && (
				<View style={styles.section}>
					<View style={styles.sectionHead}>
						<Text variant="title">Continue reading</Text>
						<Text variant="caption" muted>
							{continuing.length} in progress
						</Text>
					</View>
					<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.continueRow}>
						{continuing.map(c => (
							<ContinueCard
								key={c.id}
								comic={c}
								width={Math.min(260, width * 0.62)}
								onPress={() => navigation.navigate('Reader', { comicId: c.id })}
								onLongPress={() => openMenu(c)}
							/>
						))}
					</ScrollView>
				</View>
			)}

			{!isEmptyLibrary && (
				<View style={[styles.sectionHead, styles.gridHead]}>
					<Text variant="title">{active.key === 'all' ? 'All comics' : active.label}</Text>
					<Text variant="caption" muted>
						{grouped
							? [
									folderItems && `${folderItems} ${folderItems === 1 ? 'folder' : 'folders'}`,
									comicItems && `${comicItems} ${comicItems === 1 ? 'comic' : 'comics'}`,
									active.key === 'all' && stats?.localBytes ? `${formatBytes(stats.localBytes)} downloaded` : null,
								]
									.filter(Boolean)
									.join(' · ')
							: `${comics?.length ?? 0} ${comics?.length === 1 ? 'comic' : 'comics'}`}
					</Text>
				</View>
			)}
		</View>
	);

	return (
		<View style={[styles.screen, { backgroundColor: theme.background }]}>
			<FlashList
				data={items ?? []}
				numColumns={columns}
				keyExtractor={i => i.key}
				getItemType={i => i.kind}
				ListHeaderComponent={header}
				ListEmptyComponent={
					items ? <EmptyState library={isEmptyLibrary} search={!!search || active.key !== 'all'} /> : null
				}
				contentContainerStyle={{ paddingHorizontal: PADDING - GAP / 2, paddingBottom: 120 }}
				refreshControl={
					<RefreshControl
						refreshing={refreshing}
						onRefresh={refresh}
						colors={[theme.accent.onContainer]}
						progressBackgroundColor={theme.accent.container}
						progressViewOffset={insets.top}
					/>
				}
				renderItem={({ item }) =>
					item.kind === 'folder' ? (
						<FolderGridItem
							folder={item.folder}
							comics={item.comics}
							width={coverWidth}
							onPress={() => navigation.navigate('Folder', { folderId: item.folder.id })}
						/>
					) : (
						<GridItem comic={item.comic} width={coverWidth} onPress={open} onLongPress={openMenu} />
					)
				}
				keyboardShouldPersistTaps="handled"
			/>
			<Pressable
				accessibilityRole="button"
				onPress={() => setAdding(true)}
				android_ripple={{ color: theme.accent.primary }}
				style={[styles.fab, { backgroundColor: theme.accent.container }]}>
				<Plus size={22} color={theme.accent.onContainer} strokeWidth={2.4} />
				<Text variant="title" color={theme.accent.onContainer}>
					Add comics
				</Text>
			</Pressable>
			<ComicActions comic={menuComic} onClose={() => setMenuComic(null)} />
			<Sheet visible={adding} onClose={() => setAdding(false)}>
				<Text variant="title">Add comics</Text>
				<AddOption
					icon={<FilePlus size={20} color={theme.accent.onContainer} />}
					title="Pick files"
					lines={[
						'From phone storage, Google Drive or any app in the file picker. Files from the same folder are grouped.',
					]}
					onPress={addComics}
				/>
				<AddOption
					icon={<FolderPlus size={20} color={theme.accent.onContainer} />}
					title="Add a folder"
					lines={[
						'Kaiga adds every comic inside and picks up new ones each time it opens. Each sub-folder becomes a folder in your library.',
						"Works with phone storage and SD cards. Google Drive can't share folders; pick its files instead.",
					]}
					onPress={addFolder}
				/>
			</Sheet>
		</View>
	);
}

function AddOption({
	icon,
	title,
	lines,
	onPress,
}: {
	icon: React.ReactNode;
	title: string;
	lines: string[];
	onPress: () => void;
}) {
	const theme = useTheme();
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			android_ripple={{ color: theme.surfaceHighest }}
			style={[styles.addOption, { backgroundColor: theme.surfaceHigh }]}>
			<View style={[styles.addIcon, { backgroundColor: theme.accent.container }]}>{icon}</View>
			<View style={styles.addText}>
				<Text variant="body" weight="bold">
					{title}
				</Text>
				{lines.map(l => (
					<Text key={l} variant="caption" muted>
						{l}
					</Text>
				))}
			</View>
		</Pressable>
	);
}

function FolderGridItem({
	folder,
	comics,
	width,
	onPress,
}: {
	folder: Folder;
	comics: Comic[];
	width: number;
	onPress: () => void;
}) {
	const read = comics.filter(c => c.progressPage !== null && c.progressPage >= c.pageCount - 1).length;
	const reading = comics.some(c => c.progressPage !== null && c.progressPage < c.pageCount - 1);
	const status = [
		read === comics.length ? 'Finished' : read ? `${read} of ${comics.length} read` : reading ? 'Reading' : 'Unread',
		folder.location?.split(' › ').pop(),
	]
		.filter(Boolean)
		.join(' · ');
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Folder ${folder.name}, ${comics.length} comics, ${status}`}
			onPress={onPress}
			style={[styles.gridItem, { width: width + GAP }]}>
			<FolderCover comics={comics} width={width} count={comics.length} />
			<View>
				<Text variant="label" numberOfLines={1}>
					{folder.name}
				</Text>
				<Text variant="caption" muted numberOfLines={1} style={styles.meta}>
					{status}
				</Text>
			</View>
		</Pressable>
	);
}

const GridItem = React.memo(function GridItem({
	comic,
	width,
	onPress,
	onLongPress,
}: {
	comic: Comic;
	width: number;
	onPress: (c: Comic) => void;
	onLongPress: (c: Comic) => void;
}) {
	const progress = useDownloadProgress(comic.id);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${comic.title}, ${comicStatus(comic, progress)}`}
			accessibilityHint="Long press for bookmark, reset and remove"
			onPress={() => onPress(comic)}
			onLongPress={() => onLongPress(comic)}
			style={[styles.gridItem, { width: width + GAP }]}>
			<Cover comic={comic} width={width} />
			<View>
				<Text variant="label" numberOfLines={1}>
					{comic.title}
				</Text>
				<Text variant="caption" muted numberOfLines={1} style={styles.meta}>
					{comicStatus(comic, progress)}
				</Text>
			</View>
		</Pressable>
	);
});

function ContinueCard({
	comic,
	width,
	onPress,
	onLongPress,
}: {
	comic: Comic;
	width: number;
	onPress: () => void;
	onLongPress: () => void;
}) {
	const theme = useTheme();
	const page = (comic.progressPage ?? 0) + 1;
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`Continue ${comic.title}, page ${page} of ${comic.pageCount}`}
			onPress={onPress}
			onLongPress={onLongPress}
			style={[styles.continueCard, { width, backgroundColor: theme.surface }]}>
			<Cover comic={comic} width={52} radius={8} badges={false} />
			<View style={styles.continueInfo}>
				<View>
					<Text variant="label" weight="bold" numberOfLines={1}>
						{comic.title}
					</Text>
					<Text variant="caption" muted numberOfLines={1}>
						{comic.lastOpenedAt ? `Read ${formatRelative(comic.lastOpenedAt)}` : ''}
					</Text>
				</View>
				<View style={styles.continueProgress}>
					<View style={styles.row}>
						<ProgressBar value={page / Math.max(1, comic.pageCount)} />
					</View>
					<Text variant="caption" muted>
						Page {page} of {comic.pageCount}
					</Text>
				</View>
			</View>
		</Pressable>
	);
}

function EmptyState({ library, search }: { library: boolean; search: boolean }) {
	return (
		<View style={styles.empty}>
			<Text variant="headline" style={styles.emptyTitle}>
				{library ? 'No comics yet' : search ? 'Nothing matches' : 'Nothing here'}
			</Text>
			<Text variant="body" weight="regular" muted style={styles.emptyBody}>
				{library
					? 'Tap Add comics to pick CBZ or CBR files, or a whole folder, from your phone, Google Drive or any other app in the file picker.'
					: 'Try another search or filter.'}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	titleRow: {
		paddingHorizontal: GAP / 2,
		marginBottom: 16,
	},
	search: {
		marginHorizontal: GAP / 2,
		height: 52,
		borderRadius: 26,
		paddingHorizontal: 18,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	searchInput: {
		flex: 1,
		fontFamily: fonts.medium,
		fontSize: 15,
		paddingVertical: 0,
	},
	chipRow: {
		marginTop: 16,
		marginHorizontal: -(PADDING - GAP / 2),
	},
	chips: {
		gap: 8,
		paddingHorizontal: PADDING,
	},
	section: {
		marginTop: 22,
	},
	sectionHead: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
		paddingHorizontal: GAP / 2,
		marginBottom: 12,
	},
	gridHead: {
		marginTop: 24,
	},
	continueRow: {
		gap: 12,
		paddingHorizontal: GAP / 2,
	},
	continueCard: {
		flexDirection: 'row',
		gap: 12,
		padding: 10,
		borderRadius: radius.lg,
	},
	continueInfo: {
		flex: 1,
		justifyContent: 'space-between',
		paddingVertical: 2,
	},
	continueProgress: {
		gap: 6,
	},
	row: {
		flexDirection: 'row',
	},
	gridItem: {
		paddingHorizontal: GAP / 2,
		paddingBottom: 18,
		gap: 8,
	},
	meta: {
		marginTop: 2,
	},
	fab: {
		position: 'absolute',
		right: 16,
		bottom: 16,
		height: 56,
		paddingLeft: 16,
		paddingRight: 20,
		borderRadius: 18,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
		elevation: 6,
		overflow: 'hidden',
	},
	addOption: {
		flexDirection: 'row',
		gap: 16,
		alignItems: 'flex-start',
		padding: 12,
		borderRadius: radius.lg,
		overflow: 'hidden',
	},
	addIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	addText: {
		flex: 1,
		gap: 3,
	},
	empty: {
		paddingTop: 48,
		paddingHorizontal: 24,
		alignItems: 'center',
	},
	emptyTitle: {
		textAlign: 'center',
	},
	emptyBody: {
		textAlign: 'center',
		marginTop: 8,
	},
});
