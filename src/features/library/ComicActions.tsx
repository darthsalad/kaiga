import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
	Bookmark,
	BookmarkMinus,
	Folder as FolderIcon,
	FolderInput,
	FolderMinus,
	Info,
	RotateCcw,
	Trash2,
	type LucideIcon,
} from 'lucide-react-native';
import { Cover } from '../../components/Cover';
import { Sheet } from '../../components/Sheet';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { removeFromHistory, restoreHistory, updateComic, type Comic } from '../../db/comics';
import { useQuery } from '../../db/changes';
import { allFolders } from '../../db/folders';
import { moveToFolder, moveToNewFolder } from '../../services/folders';
import { removeComic } from '../../services/library';
import { fonts } from '../../theme/tokens';
import { useTheme } from '../../theme/ThemeProvider';
import { comicStatus } from '../comicMeta';

type Step = 'actions' | 'confirm' | 'move';

/** Long-press menu for a comic: bookmark, reset progress, move to a folder, remove from library. */
export function ComicActions({
	comic,
	onClose,
	showDetails,
	initialStep = 'actions',
}: {
	comic: Comic | null;
	onClose: () => void;
	showDetails?: boolean;
	initialStep?: Step;
}) {
	const theme = useTheme();
	const navigation = useNavigation();
	const [step, setStep] = useState<Step>(initialStep);
	useEffect(() => setStep(initialStep), [comic?.id, initialStep]);
	const confirming = step === 'confirm';

	const shown = comic;
	return (
		<Sheet visible={!!comic} onClose={onClose}>
			{shown && (
				<>
					<View style={styles.header}>
						<Cover comic={shown} width={40} radius={6} badges={false} />
						<View style={styles.flex}>
							<Text variant="title" numberOfLines={2}>
								{shown.title}
							</Text>
							<Text variant="caption" muted>
								{comicStatus(shown, undefined)}
							</Text>
						</View>
					</View>

					{confirming ? (
						<View style={styles.confirm}>
							<Text variant="body">Remove from library?</Text>
							<Text variant="caption" muted>
								{shown.storage === 'copy'
									? 'Deletes the downloaded copy, cover, progress and tags.'
									: 'Deletes the cover, progress and tags.'}{' '}
								The original file is not touched.
							</Text>
							<View style={styles.confirmButtons}>
								<Pressable
									accessibilityRole="button"
									onPress={() => setStep('actions')}
									style={[styles.confirmButton, { borderColor: theme.outline, borderWidth: 1 }]}>
									<Text variant="body" weight="bold">
										Cancel
									</Text>
								</Pressable>
								<Pressable
									accessibilityRole="button"
									onPress={async () => {
										onClose();
										await removeComic(shown);
										showSnackbar(`Removed ${shown.title}`);
									}}
									style={[styles.confirmButton, { backgroundColor: theme.errorContainer }]}>
									<Text variant="body" weight="bold" color={theme.onErrorContainer}>
										Remove
									</Text>
								</Pressable>
							</View>
						</View>
					) : step === 'move' ? (
						<MoveToFolder comic={shown} onDone={onClose} />
					) : (
						<View>
							{showDetails && (
								<Action
									icon={Info}
									label="Details"
									onPress={() => {
										onClose();
										navigation.navigate('Detail', { comicId: shown.id });
									}}
								/>
							)}
							<Action
								icon={shown.bookmarked ? BookmarkMinus : Bookmark}
								label={shown.bookmarked ? 'Remove bookmark' : 'Bookmark'}
								onPress={() => {
									onClose();
									updateComic(shown.id, { bookmarked: !shown.bookmarked });
								}}
							/>
							{shown.progressPage !== null && (
								<Action
									icon={RotateCcw}
									label="Reset progress"
									sub="Starts from page 1 and removes it from History"
									onPress={async () => {
										onClose();
										await removeFromHistory(shown.id);
										showSnackbar(`${shown.title} progress reset`, {
											label: 'Undo',
											onPress: () => restoreHistory(shown.id, shown.progressPage, shown.lastOpenedAt),
										});
									}}
								/>
							)}
							<Action icon={FolderInput} label="Move to folder…" onPress={() => setStep('move')} />
							<Action icon={Trash2} label="Remove from library" danger onPress={() => setStep('confirm')} />
						</View>
					)}
				</>
			)}
		</Sheet>
	);
}

/** Lists every folder plus "new folder"; only Kaiga's grouping changes, files stay put. */
function MoveToFolder({ comic, onDone }: { comic: Comic; onDone: () => void }) {
	const theme = useTheme();
	const [name, setName] = useState('');
	const { data: folders } = useQuery(allFolders, [], ['folders']);
	const create = async () => {
		if (!name.trim()) {
			return;
		}
		onDone();
		await moveToNewFolder(comic.id, name);
		showSnackbar(`Moved to ${name.trim()}`);
	};
	return (
		<View style={styles.move}>
			<View>
				<Text variant="title">Move to folder</Text>
				<Text variant="caption" muted>
					Only changes Kaiga's library. Files stay where they are.
				</Text>
			</View>
			<View style={styles.newRow}>
				<TextInput
					value={name}
					onChangeText={setName}
					onSubmitEditing={create}
					placeholder="New folder"
					placeholderTextColor={theme.textMuted}
					accessibilityLabel="New folder name"
					returnKeyType="done"
					style={[styles.input, { backgroundColor: theme.surfaceHigh, color: theme.text }]}
				/>
				<Pressable
					accessibilityRole="button"
					onPress={create}
					style={[styles.create, { backgroundColor: theme.accent.primary }]}>
					<Text variant="body" weight="bold" color={theme.accent.onPrimary}>
						Create
					</Text>
				</Pressable>
			</View>
			<ScrollView style={styles.folderList}>
				{(folders ?? []).map(f => {
					const current = f.id === comic.folderId;
					return (
						<Pressable
							key={f.id}
							accessibilityRole="button"
							accessibilityState={{ selected: current }}
							onPress={async () => {
								onDone();
								if (!current) {
									await moveToFolder(comic.id, f.id);
									showSnackbar(`Moved to ${f.name}`);
								}
							}}
							style={[styles.folderRow, current && { backgroundColor: theme.surfaceHigh }]}>
							<FolderIcon size={20} color={theme.text} />
							<View style={styles.flex}>
								<Text variant="body" numberOfLines={1}>
									{f.name}
								</Text>
								<Text variant="caption" muted numberOfLines={1}>
									{current ? 'Current folder' : (f.location ?? 'Your folder')}
								</Text>
							</View>
						</Pressable>
					);
				})}
			</ScrollView>
			{comic.folderId !== null && (
				<Action
					icon={FolderMinus}
					label="Take out of folder"
					onPress={async () => {
						onDone();
						await moveToFolder(comic.id, null);
					}}
				/>
			)}
		</View>
	);
}

function Action({
	icon: Icon,
	label,
	sub,
	danger,
	onPress,
}: {
	icon: LucideIcon;
	label: string;
	sub?: string;
	danger?: boolean;
	onPress: () => void;
}) {
	const theme = useTheme();
	const color = danger ? theme.error : theme.text;
	return (
		<Pressable
			accessibilityRole="button"
			onPress={onPress}
			android_ripple={{ color: theme.surfaceHighest }}
			style={styles.action}>
			<Icon size={22} color={color} />
			<View style={styles.flex}>
				<Text variant="body" color={color}>
					{label}
				</Text>
				{sub && (
					<Text variant="caption" muted>
						{sub}
					</Text>
				)}
			</View>
		</Pressable>
	);
}

const styles = StyleSheet.create({
	header: {
		flexDirection: 'row',
		gap: 14,
		alignItems: 'center',
	},
	flex: {
		flex: 1,
	},
	action: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 16,
		minHeight: 52,
		paddingVertical: 6,
	},
	confirm: {
		gap: 6,
	},
	move: {
		gap: 12,
	},
	newRow: {
		flexDirection: 'row',
		gap: 8,
	},
	input: {
		flex: 1,
		height: 44,
		borderRadius: 12,
		paddingHorizontal: 14,
		fontFamily: fonts.medium,
		fontSize: 14,
	},
	create: {
		height: 44,
		paddingHorizontal: 16,
		borderRadius: 22,
		justifyContent: 'center',
	},
	folderList: {
		maxHeight: 280,
	},
	folderRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 14,
		minHeight: 52,
		paddingHorizontal: 8,
		borderRadius: 12,
	},
	confirmButtons: {
		flexDirection: 'row',
		gap: 10,
		marginTop: 12,
	},
	confirmButton: {
		flex: 1,
		height: 48,
		borderRadius: 24,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
