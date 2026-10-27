import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { errorCodes, isErrorWithCode } from '@react-native-documents/picker';
import { ChevronRight, Folder, Minus, Plus, RefreshCw, X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Segmented, Switch } from '../../components/Controls';
import { Sheet } from '../../components/Sheet';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import { libraryRoots, type LibraryRoot } from '../../db/folders';
import { errorMessage, Kaiga } from '../../native/kaiga';
import { addLibraryFolder, scanRoot, stopWatching } from '../../services/folders';
import { clearDownloads, runCleanup } from '../../services/library';
import { paths } from '../../storage/paths';
import { useSetting, type Settings } from '../../storage/settings';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { formatBytes, formatRelative, formatTime } from '../../utils/format';
import { version } from '../../../package.json';
import { directions, wideModes, WideModePicker } from '../reader/ReaderSheet';

export function SettingsScreen() {
	const theme = useTheme();
	const navigation = useNavigation();
	const insets = useSafeAreaInsets();
	const [wideMode, setWideMode] = useSetting('wideMode');
	const [threshold, setThreshold] = useSetting('wideThreshold');
	const [direction, setDirection] = useSetting('readingDirection');
	const [rememberRotation, setRememberRotation] = useSetting('rememberRotation');
	const [keepScreenOn, setKeepScreenOn] = useSetting('keepScreenOn');
	const [pageCacheComics, setPageCacheComics] = useSetting('pageCacheComics');
	const [haptics, setHaptics] = useSetting('haptics');
	const [days, setDays] = useSetting('evictionDays');
	const [themeMode, setThemeMode] = useSetting('themeMode');
	const [dynamicColor, setDynamicColor] = useSetting('dynamicColor');
	const [coverTint, setCoverTint] = useSetting('coverTint');
	const [wideSheet, setWideSheet] = useState(false);
	const [usage, setUsage] = useState<{ archives: number; pages: number; covers: number } | null>(null);

	const measure = useCallback(() => {
		Promise.all([
			Kaiga.pathSize(paths.archivesDir),
			Kaiga.pathSize(paths.pagesRoot),
			Kaiga.pathSize(paths.coversDir),
		]).then(([archives, pages, covers]) => setUsage({ archives, pages, covers }));
	}, []);
	useFocusEffect(measure);

	const total = usage ? usage.archives + usage.pages + usage.covers : 0;
	const share = (n: number) => (total > 0 ? `${Math.max(n > 0 ? 1 : 0, (n / total) * 100)}%` : '0%');

	return (
		<ScrollView
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 8 }]}>
			<Text variant="display">Settings</Text>

			<Section title="Reading">
				<Pressable accessibilityRole="button" onPress={() => setWideSheet(true)} style={styles.row}>
					<View style={styles.flex}>
						<Text variant="body">Wide pages</Text>
						<Text variant="caption" muted>
							{wideModes.find(m => m.value === wideMode)?.label}
						</Text>
					</View>
					<ChevronRight size={18} color={theme.textMuted} />
				</Pressable>
				<Divider />
				<View style={styles.row}>
					<View style={styles.flex}>
						<Text variant="body">Treat as wide when</Text>
						<Text variant="caption" muted>
							width is at least {threshold.toFixed(1)}× the height
						</Text>
					</View>
					<Stepper
						value={threshold}
						onChange={v => setThreshold(Math.round(Math.min(1.6, Math.max(0.8, v)) * 10) / 10)}
						step={0.1}
						label="Wide page threshold"
					/>
				</View>
				<Divider />
				<View style={[styles.row, styles.column]}>
					<Text variant="body">Reading direction</Text>
					<Segmented options={directions} value={direction} onChange={setDirection} />
				</View>
				<Divider />
				<SwitchRow
					label="Remember rotation"
					sub="Each page keeps the angle you set"
					value={rememberRotation}
					onChange={setRememberRotation}
				/>
				<Divider />
				<SwitchRow label="Keep screen on" sub="While a comic is open" value={keepScreenOn} onChange={setKeepScreenOn} />
			</Section>

			<LibraryFolders />

			<Section title="Storage">
				<View style={[styles.row, styles.column]}>
					<View style={styles.usageHead}>
						<Text variant="headline">{formatBytes(total)}</Text>
						<Text variant="caption" muted>
							on this phone
						</Text>
					</View>
					<View style={[styles.usageBar, { backgroundColor: theme.surfaceHighest }]}>
						<View style={{ width: share(usage?.archives ?? 0), backgroundColor: theme.accent.primary }} />
						<View style={{ width: share(usage?.pages ?? 0), backgroundColor: theme.textFaint }} />
						<View style={{ width: share(usage?.covers ?? 0), backgroundColor: '#F0D9A8' }} />
					</View>
					<View style={styles.legend}>
						<Legend color={theme.accent.primary} label={`Comics ${formatBytes(usage?.archives ?? 0)}`} />
						<Legend color={theme.textFaint} label={`Page cache ${formatBytes(usage?.pages ?? 0)}`} />
						<Legend color="#F0D9A8" label={`Covers ${formatBytes(usage?.covers ?? 0)}`} />
					</View>
				</View>
				<Divider />
				<View style={[styles.row, styles.column]}>
					<View>
						<Text variant="body">Remove unopened downloads after</Text>
						<Text variant="caption" muted>
							Covers and progress stay. Kept-offline comics are skipped.
						</Text>
					</View>
					<Segmented
						options={[3, 7, 14, 30].map(d => ({ value: d, label: `${d} days` }))}
						value={days}
						onChange={setDays}
					/>
				</View>
				<View style={styles.row}>
					<Pressable
						accessibilityRole="button"
						onPress={async () => {
							await clearDownloads();
							measure();
							showSnackbar('Downloaded comics removed. They download again when opened.');
						}}
						style={[styles.danger, { borderColor: theme.outline }]}>
						<Text variant="body" weight="bold" color={theme.error}>
							Clear downloaded comics
						</Text>
					</Pressable>
				</View>
			</Section>

			<Section title="Appearance">
				<View style={[styles.row, styles.column]}>
					<Text variant="body">Theme</Text>
					<Segmented<Settings['themeMode']>
						options={[
							{ value: 'system', label: 'System' },
							{ value: 'light', label: 'Light' },
							{ value: 'dark', label: 'Dark' },
						]}
						value={themeMode}
						onChange={setThemeMode}
					/>
				</View>
				<Divider />
				<SwitchRow
					label="Wallpaper colors"
					sub="Match Android's Material You accent"
					value={dynamicColor}
					onChange={setDynamicColor}
				/>
				<Divider />
				<SwitchRow
					label="Tint with cover colors"
					sub="Comic pages pick up each cover's color"
					value={coverTint}
					onChange={setCoverTint}
				/>
				<Divider />
				<SwitchRow
					label="Haptic feedback"
					sub="A tick at the first and last page, a firmer one on long press"
					value={haptics}
					onChange={setHaptics}
				/>
			</Section>

			<Section title="Advanced">
				<View style={[styles.row, styles.column]}>
					<View>
						<Text variant="body">Keep pages cached for</Text>
						<Text variant="caption" muted>
							The most recently read comics open instantly. Others unpack their pages again when opened.
						</Text>
					</View>
					<Segmented
						options={[1, 3, 5, 10].map(n => ({ value: n, label: n === 1 ? '1 comic' : `${n} comics` }))}
						value={pageCacheComics}
						onChange={n => {
							setPageCacheComics(n);
							runCleanup().then(measure);
						}}
					/>
				</View>
			</Section>

			<Section title="About">
				<Pressable accessibilityRole="button" onPress={() => navigation.navigate('About')} style={styles.row}>
					<View style={styles.flex}>
						<Text variant="body">About Kaiga</Text>
						<Text variant="caption" muted>
							Version {version} · licenses
						</Text>
					</View>
					<ChevronRight size={18} color={theme.textMuted} />
				</Pressable>
			</Section>

			<Sheet visible={wideSheet} onClose={() => setWideSheet(false)}>
				<Text variant="title">Wide pages</Text>
				<WideModePicker
					value={wideMode}
					onChange={m => {
						setWideMode(m);
						setWideSheet(false);
					}}
				/>
			</Sheet>
		</ScrollView>
	);
}

function LibraryFolders() {
	const theme = useTheme();
	const [keepMissing, setKeepMissing] = useSetting('keepMissing');
	const { data: roots } = useQuery(() => libraryRoots(), [], ['roots', 'comics']);
	const [busy, setBusy] = useState<number | null>(null);
	const [removing, setRemoving] = useState<LibraryRoot | null>(null);

	const describe = (r: LibraryRoot) => {
		if (busy === r.id) {
			return 'Checking…';
		}
		if (r.error) {
			return r.error;
		}
		const counts = `${r.comicCount} ${r.comicCount === 1 ? 'comic' : 'comics'}${
			r.folderCount ? ` in ${r.folderCount} ${r.folderCount === 1 ? 'folder' : 'folders'}` : ''
		}`;
		return r.lastScanAt ? `${counts} · checked ${formatRelative(r.lastScanAt)} ${formatTime(r.lastScanAt)}` : counts;
	};

	const scan = async (r: LibraryRoot) => {
		setBusy(r.id);
		try {
			const result = await scanRoot(r);
			const parts = [
				result.added && `${result.added} new`,
				result.returned && `${result.returned} back`,
				result.missing && `${result.missing} missing`,
			].filter(Boolean);
			showSnackbar(`${r.name}: ${parts.length ? parts.join(' · ') : 'nothing new'}`);
		} catch (err) {
			showSnackbar(`${r.name}: ${errorMessage(err)}`);
		} finally {
			setBusy(null);
		}
	};

	const add = async () => {
		try {
			const r = await addLibraryFolder();
			showSnackbar(`${r.name}: ${r.added} ${r.added === 1 ? 'comic' : 'comics'} added`);
		} catch (err) {
			if (!(isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED)) {
				showSnackbar(`Couldn't add the folder: ${errorMessage(err)}`);
			}
		}
	};

	return (
		<Section title="Library folders">
			<Text variant="caption" muted style={styles.sectionNote}>
				Kaiga adds every comic in these folders and checks them for new ones each time it opens. Sub-folders become
				folders in your library.
			</Text>
			{roots?.map(r => (
				<React.Fragment key={r.id}>
					<View style={[styles.row, styles.rootRow]}>
						<View style={[styles.rootIcon, { backgroundColor: theme.accent.container }]}>
							<Folder size={20} color={theme.accent.onContainer} />
						</View>
						<View style={styles.flex}>
							<Text variant="body" weight="bold" numberOfLines={1}>
								{r.name}
							</Text>
							<Text variant="caption" muted numberOfLines={1}>
								{r.label}
							</Text>
							<Text variant="caption" color={r.error ? theme.error : theme.textMuted}>
								{describe(r)}
							</Text>
						</View>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Check ${r.name} now`}
							onPress={() => scan(r)}
							disabled={busy !== null}
							style={styles.iconButton}>
							<RefreshCw size={20} color={theme.text} />
						</Pressable>
						<Pressable
							accessibilityRole="button"
							accessibilityLabel={`Stop watching ${r.name}`}
							onPress={() => setRemoving(r)}
							style={styles.iconButton}>
							<X size={20} color={theme.textMuted} />
						</Pressable>
					</View>
					<Divider />
				</React.Fragment>
			))}
			<Pressable accessibilityRole="button" onPress={add} style={styles.row}>
				<Plus size={20} color={theme.accent.primary} strokeWidth={2.4} />
				<Text variant="body" weight="bold" color={theme.accent.primary}>
					Add a folder
				</Text>
			</Pressable>
			<Divider />
			<SwitchRow
				label="Keep missing comics"
				sub="When a file leaves a watched folder, keep it marked missing with its progress, in case it comes back or was renamed. Off removes it on the next check."
				value={keepMissing}
				onChange={setKeepMissing}
			/>

			<Sheet visible={!!removing} onClose={() => setRemoving(null)}>
				<Text variant="title">Stop watching {removing?.name}?</Text>
				<Text variant="caption" muted>
					Kaiga stops checking it for new comics. The {removing?.comicCount} comics already added stay in your library
					and keep their progress. Nothing on your phone is deleted.
				</Text>
				<Pressable
					accessibilityRole="button"
					onPress={async () => {
						const r = removing;
						setRemoving(null);
						if (r) {
							await stopWatching(r);
							showSnackbar(`Stopped watching ${r.name}`);
						}
					}}
					style={[styles.danger, { borderColor: theme.outline }]}>
					<Text variant="body" weight="bold" color={theme.error}>
						Stop watching
					</Text>
				</Pressable>
			</Sheet>
		</Section>
	);
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
	const theme = useTheme();
	return (
		<View style={styles.section}>
			<Text variant="label" weight="bold" color={theme.accent.primary} style={styles.sectionTitle}>
				{title}
			</Text>
			<View style={[styles.card, { backgroundColor: theme.surface }]}>{children}</View>
		</View>
	);
}

function Divider() {
	const theme = useTheme();
	return <View style={[styles.divider, { backgroundColor: theme.outlineVariant }]} />;
}

function SwitchRow({
	label,
	sub,
	value,
	onChange,
}: {
	label: string;
	sub: string;
	value: boolean;
	onChange: (v: boolean) => void;
}) {
	return (
		<View style={styles.row}>
			<View style={styles.flex}>
				<Text variant="body">{label}</Text>
				<Text variant="caption" muted>
					{sub}
				</Text>
			</View>
			<Switch label={label} value={value} onChange={onChange} />
		</View>
	);
}

function Stepper({
	value,
	onChange,
	step,
	label,
}: {
	value: number;
	onChange: (v: number) => void;
	step: number;
	label: string;
}) {
	const theme = useTheme();
	return (
		<View style={[styles.stepper, { borderColor: theme.outline }]}>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label}`}
				onPress={() => onChange(value - step)}
				style={styles.step}>
				<Minus size={16} color={theme.text} />
			</Pressable>
			<Text variant="label" weight="bold" color={theme.accent.primary}>
				{value.toFixed(1)}×
			</Text>
			<Pressable
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label}`}
				onPress={() => onChange(value + step)}
				style={styles.step}>
				<Plus size={16} color={theme.text} />
			</Pressable>
		</View>
	);
}

function Legend({ color, label }: { color: string; label: string }) {
	return (
		<View style={styles.legendItem}>
			<View style={[styles.legendDot, { backgroundColor: color }]} />
			<Text variant="caption" muted>
				{label}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 16,
		paddingBottom: 120,
		gap: 22,
	},
	section: {
		gap: 8,
	},
	sectionTitle: {
		marginLeft: 4,
	},
	sectionNote: {
		paddingHorizontal: 16,
		paddingTop: 14,
	},
	rootRow: {
		paddingRight: 4,
	},
	rootIcon: {
		width: 40,
		height: 40,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
	},
	iconButton: {
		width: 44,
		height: 44,
		alignItems: 'center',
		justifyContent: 'center',
	},
	card: {
		borderRadius: radius.xl,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingHorizontal: 16,
		paddingVertical: 14,
	},
	column: {
		flexDirection: 'column',
		alignItems: 'stretch',
		gap: 10,
	},
	flex: {
		flex: 1,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginHorizontal: 16,
	},
	usageHead: {
		flexDirection: 'row',
		alignItems: 'baseline',
		justifyContent: 'space-between',
	},
	usageBar: {
		height: 10,
		borderRadius: 5,
		overflow: 'hidden',
		flexDirection: 'row',
		gap: 2,
	},
	legend: {
		flexDirection: 'row',
		flexWrap: 'wrap',
		columnGap: 16,
		rowGap: 6,
	},
	legendItem: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 6,
	},
	legendDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	danger: {
		flex: 1,
		height: 44,
		borderRadius: 22,
		borderWidth: 1,
		alignItems: 'center',
		justifyContent: 'center',
	},
	stepper: {
		flexDirection: 'row',
		alignItems: 'center',
		borderWidth: 1,
		borderRadius: 20,
		gap: 4,
	},
	step: {
		width: 40,
		height: 40,
		alignItems: 'center',
		justifyContent: 'center',
	},
});
