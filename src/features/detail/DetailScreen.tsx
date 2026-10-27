import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import {
	AlertCircle,
	Bookmark,
	ChevronLeft,
	ChevronRight,
	Cloud,
	EllipsisVertical,
	Folder as FolderIcon,
	FolderInput,
	FolderOpen,
	Play,
	Plus,
	Smartphone,
	Trash2,
	X,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, ProgressBar, Switch } from '../../components/Controls';
import { Cover } from '../../components/Cover';
import { IconButton } from '../../components/IconButton';
import { Sheet } from '../../components/Sheet';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import { getComic, rotatedPageCount, updateComic, type Comic } from '../../db/comics';
import { getFolder } from '../../db/folders';
import { addTag, allTags, removeTag, tagsFor } from '../../db/tags';
import { errorMessage } from '../../native/kaiga';
import type { RootScreenProps } from '../../navigation/types';
import { useDownloadProgress } from '../../services/jobs';
import { evictComic, refetch, relinkComic, removeComic } from '../../services/library';
import { useSetting } from '../../storage/settings';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, radius } from '../../theme/tokens';
import { readableOn } from '../../utils/color';
import { formatBytes, formatDate, formatRelative } from '../../utils/format';
import { formatLabel, isFinished } from '../comicMeta';
import { ComicActions } from '../library/ComicActions';

const DAY = 24 * 60 * 60 * 1000;

export function DetailScreen({ route, navigation }: RootScreenProps<'Detail'>) {
	const { comicId } = route.params;
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const [coverTint] = useSetting('coverTint');
	const [menuOpen, setMenuOpen] = useState(false);
	const [moving, setMoving] = useState(false);

	const { data: comic } = useQuery(() => getComic(comicId), [comicId], ['comics']);
	const { data: rotated } = useQuery(() => rotatedPageCount(comicId), [comicId], ['pages']);
	const folderId = comic?.folderId ?? null;
	const { data: folder } = useQuery(
		() => (folderId === null ? Promise.resolve(null) : getFolder(folderId).then(f => f ?? null)),
		[folderId],
		['folders'],
	);

	if (!comic) {
		return <View style={[styles.screen, { backgroundColor: theme.background }]} />;
	}

	const headerBg = coverTint && comic.coverColor ? comic.coverColor : theme.surface;
	const headerFg = coverTint && comic.coverColor ? readableOn(headerBg) : theme.text;
	const headerMuted = headerFg === '#FFFFFF' ? 'rgba(255,255,255,0.78)' : theme.textMuted;
	const page = comic.progressPage;
	const finished = isFinished(comic);
	const readable = comic.localState !== 'unavailable' && comic.localState !== 'error';

	const relink = async () => {
		try {
			if (await relinkComic(comic)) {
				showSnackbar('Fetching the file again');
			}
		} catch (err) {
			if (!(isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)) {
				showSnackbar(errorMessage(err));
			}
		}
	};

	return (
		<View style={[styles.screen, { backgroundColor: theme.background }]}>
			<ScrollView contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}>
				<View style={[styles.header, { backgroundColor: headerBg, paddingTop: insets.top + 4 }]}>
					<View style={styles.topBar}>
						<IconButton
							icon={ChevronLeft}
							label="Back"
							onPress={() => navigation.goBack()}
							color={headerFg}
							size={24}
						/>
						<View style={styles.row}>
							<IconButton
								icon={Bookmark}
								label={comic.bookmarked ? 'Remove bookmark' : 'Bookmark comic'}
								selected={false}
								color={comic.bookmarked ? theme.accent.primary : headerFg}
								fill={comic.bookmarked ? theme.accent.primary : 'none'}
								onPress={() => updateComic(comic.id, { bookmarked: !comic.bookmarked })}
							/>
							<IconButton
								icon={EllipsisVertical}
								label="More options"
								color={headerFg}
								onPress={() => setMenuOpen(true)}
							/>
						</View>
					</View>

					<View style={styles.hero}>
						<Cover comic={comic} width={124} badges={false} style={styles.heroCover} />
						<View style={styles.heroInfo}>
							<Text variant="headline" color={headerFg} numberOfLines={3}>
								{comic.title}
							</Text>
							<Text variant="caption" color={headerMuted} numberOfLines={2}>
								{comic.sourceName}
							</Text>
							<View style={styles.metaChips}>
								{formatLabel(comic.format) && <MetaChip label={formatLabel(comic.format)!} color={headerFg} />}
								{comic.issueNumber && (
									<MetaChip
										label={`#${comic.issueNumber}${comic.issueCount ? ` of ${comic.issueCount}` : ''}`}
										color={headerFg}
									/>
								)}
								{comic.year && <MetaChip label={String(comic.year)} color={headerFg} />}
								{comic.pageCount > 0 && <MetaChip label={`${comic.pageCount} pages`} color={headerFg} />}
								{!!rotated && <MetaChip label={`${rotated} rotated`} color={headerFg} />}
							</View>
						</View>
					</View>
				</View>

				<View style={styles.body}>
					{comic.localState === 'error' ? null : readable ? (
						<Button
							label={finished ? 'Read again' : page !== null ? `Continue · page ${page + 1}` : 'Start reading'}
							icon={<Play size={18} color={theme.accent.onPrimary} fill={theme.accent.onPrimary} />}
							onPress={() => navigation.navigate('Reader', { comicId: comic.id })}
						/>
					) : (
						<Button
							label="Pick the file again"
							icon={<FolderOpen size={18} color={theme.accent.onPrimary} />}
							onPress={relink}
						/>
					)}

					{page !== null && comic.pageCount > 0 && (
						<View style={styles.progressRow}>
							<ProgressBar value={(page + 1) / comic.pageCount} />
							<Text variant="caption" muted>
								{Math.round(((page + 1) / comic.pageCount) * 100)}%
								{comic.lastOpenedAt ? ` · read ${formatRelative(comic.lastOpenedAt)}` : ''}
							</Text>
						</View>
					)}

					<AboutCard comic={comic} />

					<TagEditor comicId={comic.id} />

					{comic.error && (
						<View style={[styles.card, styles.cardRow, { backgroundColor: theme.errorContainer }]}>
							<AlertCircle size={20} color={theme.onErrorContainer} />
							<View style={styles.flex}>
								<Text variant="body" color={theme.onErrorContainer}>
									{comic.error}
								</Text>
								{comic.localState === 'error' && (
									<Pressable accessibilityRole="button" onPress={() => refetch(comic.id)} style={styles.inlineAction}>
										<Text variant="label" weight="bold" color={theme.onErrorContainer}>
											Try again
										</Text>
									</Pressable>
								)}
							</View>
						</View>
					)}

					<StorageCard comic={comic} />

					<View style={[styles.card, styles.cardRow, { backgroundColor: theme.surface }]}>
						<View style={[styles.cardIcon, { backgroundColor: theme.surfaceHigh }]}>
							<Cloud size={20} color={theme.text} />
						</View>
						<View style={styles.flex}>
							<Text variant="body" weight="bold">
								{comic.sourceLabel ?? 'Files'}
							</Text>
							<Text variant="caption" muted style={styles.cardLine}>
								{comic.sourceName}
							</Text>
							<Text variant="caption" muted>
								{comic.rootId !== null ? 'From a library folder' : 'Picked with the system picker'} · added{' '}
								{formatDate(comic.addedAt)}
							</Text>
						</View>
					</View>

					<Pressable
						accessibilityRole="button"
						onPress={() => (folder ? navigation.navigate('Folder', { folderId: folder.id }) : setMoving(true))}
						style={[styles.card, styles.cardRow, styles.center, { backgroundColor: theme.surface }]}>
						<View style={[styles.cardIcon, { backgroundColor: theme.surfaceHigh }]}>
							<FolderIcon size={20} color={theme.text} />
						</View>
						<View style={styles.flex}>
							<Text variant="body" weight="bold" numberOfLines={1}>
								{folder ? folder.name : 'Not in a folder'}
							</Text>
							<Text variant="caption" muted numberOfLines={1}>
								{folder ? (folder.location ?? 'Your folder') : 'Tap to move it into one'}
							</Text>
						</View>
						{folder && <ChevronRight size={18} color={theme.textMuted} />}
					</Pressable>
				</View>
			</ScrollView>

			<Sheet visible={menuOpen} onClose={() => setMenuOpen(false)}>
				{comic.localState === 'ready' && comic.storage === 'copy' && (
					<MenuItem
						icon={Smartphone}
						label="Remove download"
						sub="Frees space. Opens from the source again when you read it."
						onPress={async () => {
							setMenuOpen(false);
							await evictComic(comic);
						}}
					/>
				)}
				<MenuItem
					icon={FolderInput}
					label="Move to folder…"
					sub="Group it with other comics in your library"
					onPress={() => {
						setMenuOpen(false);
						setMoving(true);
					}}
				/>
				<MenuItem
					icon={FolderOpen}
					label="Pick the file again"
					sub="Use when the file moved or access was lost"
					onPress={() => {
						setMenuOpen(false);
						relink();
					}}
				/>
				<MenuItem
					icon={Trash2}
					label="Remove from library"
					sub="Deletes the downloaded copy, cover and progress. The original file is not touched."
					danger
					onPress={async () => {
						setMenuOpen(false);
						navigation.goBack();
						await removeComic(comic);
						showSnackbar(`Removed ${comic.title}`);
					}}
				/>
			</Sheet>

			<ComicActions comic={moving ? comic : null} onClose={() => setMoving(false)} initialStep="move" />
		</View>
	);
}

function MetaChip({ label, color }: { label: string; color: string }) {
	return (
		<View style={[styles.metaChip, color !== '#FFFFFF' && styles.metaChipDark]}>
			<Text variant="caption" weight="semibold" color={color}>
				{label}
			</Text>
		</View>
	);
}

function StorageCard({ comic }: { comic: Comic }) {
	const theme = useTheme();
	const [days] = useSetting('evictionDays');
	const progress = useDownloadProgress(comic.id);
	const direct = comic.storage === 'direct';
	const size = comic.localSize ?? comic.sourceSize;

	let title: string;
	let sub: string;
	if (direct) {
		title = `On phone${size ? ` · ${formatBytes(size)}` : ''}`;
		sub =
			comic.localState === 'error'
				? `Kaiga reads this file straight from ${comic.sourceLabel ?? 'your phone'}, but couldn't read pages from it.`
				: `Read straight from ${comic.sourceLabel ?? 'your phone'}. Kaiga keeps no second copy, so nothing is cleaned up.`;
	} else if (progress !== undefined || comic.localState === 'downloading' || comic.localState === 'queued') {
		title = `Downloading · ${Math.round((progress ?? 0) * 100)}%`;
		sub = `Copying from ${comic.sourceLabel ?? 'the source'} so it reads offline.`;
	} else if (comic.localState === 'ready') {
		title = `Downloaded${size ? ` · ${formatBytes(size)}` : ''}`;
		sub = comic.keepOffline
			? 'Kept offline. Never removed automatically.'
			: `Removed after ${days} days unopened${
					comic.lastAccessedAt ? `, on ${formatDate(comic.lastAccessedAt + days * DAY)}` : ''
				}. Cover and progress stay; it downloads again when you open it.`;
	} else if (comic.localState === 'evicted') {
		title = 'Not on phone';
		sub = `Downloads from ${comic.sourceLabel ?? 'the source'} when you open it.`;
	} else {
		title = 'Not on phone';
		sub = "The last download didn't finish.";
	}

	return (
		<View style={[styles.card, { backgroundColor: theme.surface }]}>
			<View style={styles.cardRow}>
				<View style={[styles.cardIcon, { backgroundColor: theme.accent.container }]}>
					<Smartphone size={20} color={theme.accent.onContainer} />
				</View>
				<View style={styles.flex}>
					<Text variant="body" weight="bold">
						{title}
					</Text>
					<Text variant="caption" muted style={styles.cardLine}>
						{sub}
					</Text>
					{progress !== undefined && (
						<View style={[styles.row, styles.cardLine]}>
							<ProgressBar value={progress} />
						</View>
					)}
				</View>
			</View>
			{!direct && (
				<>
					<View style={[styles.divider, { backgroundColor: theme.outlineVariant }]} />
					<View style={styles.switchRow}>
						<View style={styles.flex}>
							<Text variant="body">Keep offline</Text>
							<Text variant="caption" muted>
								Skip the {days}-day cleanup
							</Text>
						</View>
						<Switch
							label="Keep offline"
							value={comic.keepOffline}
							onChange={value => {
								updateComic(comic.id, { keepOffline: value });
								if (value && comic.localState === 'evicted') {
									refetch(comic.id);
								}
							}}
						/>
					</View>
				</>
			)}
		</View>
	);
}

function TagEditor({ comicId }: { comicId: number }) {
	const theme = useTheme();
	const [adding, setAdding] = useState(false);
	const [draft, setDraft] = useState('');
	const { data: tags } = useQuery(() => tagsFor(comicId), [comicId], ['tags']);
	const { data: everyTag } = useQuery(allTags, [], ['tags']);
	const suggestions = (everyTag ?? []).filter(t => !tags?.some(own => own.id === t.id)).slice(0, 12);

	const submit = async (name: string) => {
		setDraft('');
		await addTag(comicId, name);
	};

	return (
		<View style={styles.tags}>
			<View style={styles.tagRow}>
				{tags?.map(t => (
					<Pressable
						key={t.id}
						accessibilityRole="button"
						accessibilityLabel={`Remove tag ${t.name}`}
						onPress={() => removeTag(comicId, t.id)}
						style={[styles.tag, { backgroundColor: theme.surfaceHigh }]}>
						<Text variant="label">#{t.name}</Text>
						<X size={14} color={theme.textMuted} strokeWidth={2.4} />
					</Pressable>
				))}
				<Pressable
					accessibilityRole="button"
					accessibilityState={{ expanded: adding }}
					onPress={() => setAdding(!adding)}
					style={[styles.tag, styles.addTag, { borderColor: theme.outline }]}>
					<Plus size={14} color={theme.accent.primary} strokeWidth={2.6} />
					<Text variant="label" weight="bold" color={theme.accent.primary}>
						Add tag
					</Text>
				</Pressable>
			</View>
			{adding && (
				<View style={[styles.card, { backgroundColor: theme.surface, gap: 10, padding: 12 }]}>
					<View style={styles.row}>
						<TextInput
							value={draft}
							onChangeText={setDraft}
							onSubmitEditing={() => submit(draft)}
							placeholder="New tag"
							placeholderTextColor={theme.textMuted}
							accessibilityLabel="New tag"
							autoCapitalize="none"
							autoFocus
							returnKeyType="done"
							style={[styles.tagInput, { backgroundColor: theme.surfaceHigh, color: theme.text }]}
						/>
						<Pressable
							accessibilityRole="button"
							onPress={() => submit(draft)}
							style={[styles.tagAdd, { backgroundColor: theme.accent.primary }]}>
							<Text variant="body" weight="bold" color={theme.accent.onPrimary}>
								Add
							</Text>
						</Pressable>
					</View>
					{suggestions.length > 0 && (
						<View style={styles.tagRow}>
							{suggestions.map(t => (
								<Pressable
									key={t.id}
									accessibilityRole="button"
									accessibilityLabel={`Add tag ${t.name}`}
									onPress={() => submit(t.name)}
									style={[styles.suggestion, { borderColor: theme.outline }]}>
									<Text variant="caption" weight="semibold">
										#{t.name}
									</Text>
								</Pressable>
							))}
						</View>
					)}
				</View>
			)}
		</View>
	);
}

function MenuItem({
	icon: Icon,
	label,
	sub,
	onPress,
	danger,
}: {
	icon: typeof Trash2;
	label: string;
	sub: string;
	onPress: () => void;
	danger?: boolean;
}) {
	const theme = useTheme();
	const color = danger ? theme.error : theme.text;
	return (
		<Pressable accessibilityRole="button" onPress={onPress} style={styles.menuItem}>
			<Icon size={22} color={color} />
			<View style={styles.flex}>
				<Text variant="body" color={color}>
					{label}
				</Text>
				<Text variant="caption" muted>
					{sub}
				</Text>
			</View>
		</Pressable>
	);
}

/** Summary and credits from the comic's ComicInfo.xml, when it has any. */
function AboutCard({ comic }: { comic: Comic }) {
	const theme = useTheme();
	const [expanded, setExpanded] = useState(false);
	const credits = [
		['Series', comic.series && comic.volume ? `${comic.series}, volume ${comic.volume}` : null],
		['Writer', comic.writer],
		['Art', comic.artist],
		['Publisher', comic.publisher],
		['Genre', comic.genre],
	].filter((c): c is [string, string] => !!c[1]);
	if (!comic.summary && !credits.length) {
		return null;
	}
	return (
		<View style={[styles.card, styles.about, { backgroundColor: theme.surface }]}>
			{comic.summary && (
				<Pressable
					accessibilityRole="button"
					accessibilityHint={expanded ? 'Shows less' : 'Shows the whole summary'}
					onPress={() => setExpanded(e => !e)}>
					<Text variant="body" numberOfLines={expanded ? undefined : 4}>
						{comic.summary}
					</Text>
				</Pressable>
			)}
			{credits.map(([label, value]) => (
				<View key={label} style={styles.credit}>
					<Text variant="caption" muted style={styles.creditLabel}>
						{label}
					</Text>
					<Text variant="caption" style={styles.flex}>
						{value}
					</Text>
				</View>
			))}
		</View>
	);
}

const styles = StyleSheet.create({
	screen: {
		flex: 1,
	},
	header: {
		paddingHorizontal: 8,
		paddingBottom: 24,
		borderBottomLeftRadius: radius.xxl,
		borderBottomRightRadius: radius.xxl,
	},
	topBar: {
		flexDirection: 'row',
		justifyContent: 'space-between',
	},
	row: {
		flexDirection: 'row',
	},
	hero: {
		flexDirection: 'row',
		gap: 18,
		paddingHorizontal: 12,
		paddingTop: 8,
	},
	heroCover: {
		elevation: 8,
	},
	heroInfo: {
		flex: 1,
		gap: 6,
		paddingTop: 6,
	},
	metaChips: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 6,
		marginTop: 8,
	},
	metaChip: {
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 8,
		backgroundColor: 'rgba(255,255,255,0.14)',
	},
	metaChipDark: {
		backgroundColor: 'rgba(0,0,0,0.08)',
	},
	body: {
		padding: 16,
		gap: 14,
	},
	progressRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	card: {
		borderRadius: radius.xl,
		padding: 16,
	},
	about: {
		gap: 10,
	},
	credit: {
		flexDirection: 'row',
		gap: 12,
	},
	creditLabel: {
		width: 72,
	},
	cardRow: {
		flexDirection: 'row',
		gap: 14,
		alignItems: 'flex-start',
	},
	center: {
		alignItems: 'center',
	},
	cardIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	cardLine: {
		marginTop: 3,
	},
	flex: {
		flex: 1,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginVertical: 14,
	},
	switchRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	inlineAction: {
		marginTop: 8,
		alignSelf: 'flex-start',
		paddingVertical: 4,
	},
	tags: {
		gap: 10,
	},
	tagRow: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		gap: 8,
	},
	tag: {
		height: 32,
		paddingLeft: 12,
		paddingRight: 8,
		borderRadius: 8,
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	addTag: {
		borderWidth: 1,
		borderStyle: 'dashed',
		paddingLeft: 10,
		paddingRight: 12,
	},
	tagInput: {
		flex: 1,
		height: 40,
		borderRadius: 10,
		paddingHorizontal: 12,
		fontFamily: fonts.medium,
		fontSize: 14,
		marginRight: 8,
	},
	tagAdd: {
		height: 40,
		paddingHorizontal: 16,
		borderRadius: 20,
		justifyContent: 'center',
	},
	suggestion: {
		height: 30,
		paddingHorizontal: 10,
		borderRadius: 8,
		borderWidth: 1,
		justifyContent: 'center',
	},
	menuItem: {
		flexDirection: 'row',
		gap: 16,
		alignItems: 'flex-start',
		paddingVertical: 6,
	},
});
