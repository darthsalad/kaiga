import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import {
	CheckCheck,
	ChevronLeft,
	EllipsisVertical,
	Folder as FolderIcon,
	Pencil,
	Play,
	RotateCcw,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ProgressBar } from '../../components/Controls';
import { Cover } from '../../components/Cover';
import { FolderCover } from '../../components/FolderCover';
import { IconButton } from '../../components/IconButton';
import { Sheet } from '../../components/Sheet';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import { comicsInFolder, restoreHistory, removeFromHistory, updateComic, type Comic } from '../../db/comics';
import { getFolder, renameFolder } from '../../db/folders';
import type { RootScreenProps } from '../../navigation/types';
import { useDownloadProgress } from '../../services/jobs';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius } from '../../theme/tokens';
import { formatBytes } from '../../utils/format';
import { nextInFolder, readingOrder } from '../../utils/folders';
import { haptic } from '../../utils/haptics';
import { comicStatus, isFinished } from '../comicMeta';
import { ComicActions } from '../library/ComicActions';

export function FolderScreen({ route, navigation }: RootScreenProps<'Folder'>) {
	const { folderId } = route.params;
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { data: folder } = useQuery(() => getFolder(folderId), [folderId], ['folders']);
	const { data: unsorted } = useQuery(() => comicsInFolder(folderId), [folderId], ['comics']);
	const comics = useMemo(() => [...(unsorted ?? [])].sort(readingOrder), [unsorted]);
	const [menuComic, setMenuComic] = useState<Comic | null>(null);
	const [folderMenu, setFolderMenu] = useState(false);
	const [renaming, setRenaming] = useState<string | null>(null);

	if (!folder) {
		return <View style={[styles.screen, { backgroundColor: theme.background }]} />;
	}

	const read = comics.filter(isFinished).length;
	const bytes = comics.reduce((sum, c) => sum + (c.localSize ?? c.sourceSize ?? 0), 0);
	const next = nextInFolder(comics);
	const nextIndex = next ? comics.indexOf(next) + 1 : 0;
	const allRead = comics.length > 0 && read === comics.length;

	const markAllRead = async () => {
		setFolderMenu(false);
		for (const c of comics) {
			if (c.pageCount > 0) {
				await updateComic(c.id, { progressPage: c.pageCount - 1, lastOpenedAt: c.lastOpenedAt ?? Date.now() });
			}
		}
	};
	const resetAll = async () => {
		setFolderMenu(false);
		const before = comics.map(c => ({ id: c.id, progressPage: c.progressPage, lastOpenedAt: c.lastOpenedAt }));
		for (const c of comics) {
			await removeFromHistory(c.id);
		}
		showSnackbar(`Progress reset for ${folder.name}`, {
			label: 'Undo',
			onPress: () => before.forEach(b => restoreHistory(b.id, b.progressPage, b.lastOpenedAt)),
		});
	};

	return (
		<View style={[styles.screen, { backgroundColor: theme.background }]}>
			<FlatList
				data={comics}
				keyExtractor={c => String(c.id)}
				contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
				ListHeaderComponent={
					<View>
						<View style={[styles.header, { backgroundColor: theme.surface, paddingTop: insets.top + 4 }]}>
							<View style={styles.topBar}>
								<IconButton icon={ChevronLeft} label="Back" size={24} onPress={() => navigation.goBack()} />
								<IconButton icon={EllipsisVertical} label="Folder options" onPress={() => setFolderMenu(true)} />
							</View>
							<View style={styles.hero}>
								<FolderCover comics={comics} width={112} count={comics.length} />
								<View style={styles.heroInfo}>
									<Text variant="headline" numberOfLines={3}>
										{folder.name}
									</Text>
									{folder.location ? (
										<View style={styles.location}>
											<FolderIcon size={14} color={theme.textMuted} />
											<Text variant="caption" muted numberOfLines={2} style={styles.flex}>
												{folder.location}
											</Text>
										</View>
									) : (
										<Text variant="caption" muted>
											Your folder
										</Text>
									)}
									<Text variant="caption" muted>
										{comics.length} {comics.length === 1 ? 'comic' : 'comics'} · {read} read
										{bytes ? ` · ${formatBytes(bytes)}` : ''}
									</Text>
								</View>
							</View>
						</View>
						<View style={styles.body}>
							{next && (
								<Button
									label={
										allRead
											? 'Read again from #1'
											: next.progressPage !== null
												? `Continue #${nextIndex} · page ${next.progressPage + 1}`
												: `Start #${nextIndex}`
									}
									icon={<Play size={18} color={theme.accent.onPrimary} fill={theme.accent.onPrimary} />}
									onPress={() => navigation.navigate('Reader', { comicId: next.id })}
								/>
							)}
							<View style={styles.sectionHead}>
								<Text variant="title">Comics</Text>
								<Text variant="caption" muted>
									{comics.some(c => c.issueNumber) ? 'By issue' : 'By file name'}
								</Text>
							</View>
						</View>
					</View>
				}
				renderItem={({ item, index }) => (
					<FolderRow
						comic={item}
						number={index + 1}
						onPress={() =>
							item.localState === 'unavailable'
								? navigation.navigate('Detail', { comicId: item.id })
								: navigation.navigate('Reader', { comicId: item.id })
						}
						onMenu={() => setMenuComic(item)}
					/>
				)}
			/>

			<ComicActions comic={menuComic} onClose={() => setMenuComic(null)} showDetails />

			<Sheet visible={folderMenu} onClose={() => setFolderMenu(false)}>
				<Text variant="title" numberOfLines={2}>
					{folder.name}
				</Text>
				<MenuRow
					icon={<Pencil size={22} color={theme.text} />}
					label="Rename"
					onPress={() => {
						setFolderMenu(false);
						setRenaming(folder.name);
					}}
				/>
				<MenuRow icon={<CheckCheck size={22} color={theme.text} />} label="Mark all as read" onPress={markAllRead} />
				<MenuRow icon={<RotateCcw size={22} color={theme.text} />} label="Reset progress for all" onPress={resetAll} />
			</Sheet>

			<Sheet visible={renaming !== null} onClose={() => setRenaming(null)}>
				<Text variant="title">Rename folder</Text>
				<Text variant="caption" muted>
					Only changes the name in Kaiga. The folder on your phone keeps its name.
				</Text>
				<TextInput
					value={renaming ?? ''}
					onChangeText={setRenaming}
					autoFocus
					accessibilityLabel="Folder name"
					style={[styles.input, { backgroundColor: theme.surfaceHigh, color: theme.text }]}
				/>
				<Button
					label="Save"
					onPress={async () => {
						if (renaming?.trim()) {
							await renameFolder(folder.id, renaming);
						}
						setRenaming(null);
					}}
				/>
			</Sheet>
		</View>
	);
}

function FolderRow({
	comic,
	number,
	onPress,
	onMenu,
}: {
	comic: Comic;
	number: number;
	onPress: () => void;
	onMenu: () => void;
}) {
	const theme = useTheme();
	const progress = useDownloadProgress(comic.id);
	const missing = comic.localState === 'unavailable';
	const finished = isFinished(comic);
	const reading = comic.progressPage !== null && !finished;
	const status = missing ? 'File missing · progress kept' : comicStatus(comic, progress);
	return (
		<Pressable
			accessibilityRole="button"
			accessibilityLabel={`${number}. ${comic.title}, ${status}`}
			accessibilityHint="Long press for options"
			onPress={onPress}
			onLongPress={() => {
				haptic('long');
				onMenu();
			}}
			android_ripple={{ color: theme.surfaceHigh }}
			style={styles.row}>
			<View style={missing && styles.faded}>
				<Cover comic={comic} width={44} radius={7} />
			</View>
			<View style={styles.rowInfo}>
				<Text variant="body" weight="bold" numberOfLines={1} color={finished || missing ? theme.textMuted : theme.text}>
					{comic.title}
				</Text>
				<Text variant="caption" color={missing ? theme.error : theme.textMuted}>
					{status}
				</Text>
				{reading && (
					<View style={styles.bar}>
						<ProgressBar value={((comic.progressPage ?? 0) + 1) / Math.max(1, comic.pageCount)} />
					</View>
				)}
			</View>
			<IconButton
				icon={EllipsisVertical}
				label={`Options for ${comic.title}`}
				color={theme.textMuted}
				size={20}
				onPress={onMenu}
			/>
		</Pressable>
	);
}

function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.menuRow}>
			{icon}
			<Text variant="body">{label}</Text>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 8,
		paddingBottom: 22,
		borderBottomLeftRadius: radius.xxl,
		borderBottomRightRadius: radius.xxl,
	},
	topBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	hero: {
		flexDirection: 'row',
		gap: 18,
		paddingHorizontal: 12,
		paddingTop: 10,
		alignItems: 'flex-end',
	},
	heroInfo: {
		flex: 1,
		gap: 6,
		paddingBottom: 4,
	},
	location: {
		flexDirection: 'row',
		gap: 6,
		alignItems: 'center',
	},
	flex: {
		flex: 1,
	},
	body: {
		padding: 16,
		gap: 16,
	},
	sectionHead: {
		flexDirection: 'row',
		justifyContent: 'space-between',
		alignItems: 'baseline',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		paddingLeft: 16,
		paddingRight: 4,
		paddingVertical: 8,
	},
	faded: {
		opacity: 0.45,
	},
	rowInfo: {
		flex: 1,
		gap: 4,
	},
	bar: {
		flexDirection: 'row',
		marginTop: 2,
	},
	menuRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		minHeight: 52,
	},
	input: {
		height: 48,
		borderRadius: 12,
		paddingHorizontal: 14,
		fontFamily: fonts.medium,
		fontSize: 15,
	},
});
