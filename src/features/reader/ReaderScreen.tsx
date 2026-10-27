import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StatusBar, StyleSheet, useWindowDimensions, View } from 'react-native';
import { ChevronLeft, Columns2, Download, RotateCw, SlidersHorizontal } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar } from '../../components/Controls';
import { Cover } from '../../components/Cover';
import { IconButton } from '../../components/IconButton';
import { showSnackbar } from '../../components/Snackbar';
import { Text } from '../../components/Text';
import { useQuery } from '../../db/changes';
import {
	comicsInFolder,
	getComic,
	getPages,
	getRotations,
	markOpened,
	saveProgress,
	setRotation,
	updateComic,
	type Comic,
	type Page,
	type Rotation,
} from '../../db/comics';
import { errorMessage, Kaiga } from '../../native/kaiga';
import type { RootScreenProps } from '../../navigation/types';
import { useDownloadProgress } from '../../services/jobs';
import { archiveSource, ensureLocal, isArchiveAvailable, setOpenComic } from '../../services/library';
import { fileUri } from '../../storage/paths';
import { useSetting, type ReadingDirection } from '../../storage/settings';
import { useTheme } from '../../theme/ThemeProvider';
import { readingOrder } from '../../utils/folders';
import { haptic } from '../../utils/haptics';
import { isFinished } from '../comicMeta';
import {
	effectiveRotation,
	isSpread,
	nextPosition,
	previousPosition,
	screenSide,
	usesHalves,
	type Navigator,
	type Position,
} from './layout';
import { PageView } from './PageView';
import { ReaderSheet } from './ReaderSheet';
import { Scrubber } from './Scrubber';
import { usePageFiles, type PageFile } from './usePageFiles';

export function ReaderScreen({ route, navigation }: RootScreenProps<'Reader'>) {
	const { comicId } = route.params;
	const { data: comic } = useQuery(() => getComic(comicId), [comicId], ['comics']);
	const { data: pages } = useQuery(() => getPages(comicId), [comicId], ['pages']);

	useEffect(() => {
		setOpenComic(comicId);
		return () => setOpenComic(null);
	}, [comicId]);

	const [keepScreenOn] = useSetting('keepScreenOn');
	useEffect(() => {
		if (!keepScreenOn) {
			return;
		}
		Kaiga.setKeepScreenOn(true);
		return () => Kaiga.setKeepScreenOn(false);
	}, [keepScreenOn]);

	if (!comic || !pages) {
		return <View style={styles.black} />;
	}
	return (
		<Reader
			key={comic.id}
			comic={comic}
			pages={pages}
			onClose={() => navigation.goBack()}
			onOpen={id => navigation.replace('Reader', { comicId: id })}
		/>
	);
}

function Reader({
	comic,
	pages,
	onClose,
	onOpen,
}: {
	comic: Comic;
	pages: Page[];
	onClose: () => void;
	onOpen: (comicId: number) => void;
}) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const { width: W, height: H } = useWindowDimensions();
	// a comic can carry its own direction (manga marked right-to-left); changing it then stays per comic
	const [defaultDirection, setDefaultDirection] = useSetting('readingDirection');
	const direction = comic.readingDirection ?? defaultDirection;
	const setDirection = useCallback(
		(d: ReadingDirection) =>
			comic.readingDirection ? updateComic(comic.id, { readingDirection: d }) : setDefaultDirection(d),
		[comic.id, comic.readingDirection, setDefaultDirection],
	);
	const [wideMode, setWideMode] = useSetting('wideMode');
	const [threshold] = useSetting('wideThreshold');
	const [rememberRotation] = useSetting('rememberRotation');

	const { data: savedRotations } = useQuery(() => getRotations(comic.id), [comic.id], ['pages']);
	const [sessionRotations, setSessionRotations] = useState<Map<string, Rotation>>(() => new Map());

	const [pos, setPos] = useState<Position>(() => ({
		index: comic.progressPage !== null && !isFinished(comic) ? Math.min(comic.progressPage, pages.length - 1) : 0,
		part: 'first',
	}));
	const [chrome, setChrome] = useState(true);
	const [sheet, setSheet] = useState(false);

	// ---- archive availability ----
	const archiveReady = isArchiveAvailable(comic);
	const downloadProgress = useDownloadProgress(comic.id);
	const [loadError, setLoadError] = useState<string | null>(null);
	useEffect(() => {
		if (!archiveReady) {
			ensureLocal(comic.id).catch(err => setLoadError(errorMessage(err)));
		}
	}, [archiveReady, comic.id]);

	// ZIP pages can be unpacked in any order, so a paused scrub pulls the page under the thumb first.
	// RAR and 7z unpack in one pass from the start, so restarting for a preview would only slow them down.
	const [previewIndex, setPreviewIndex] = useState<number | null>(null);
	const around = comic.format === 'zip' && previewIndex !== null ? previewIndex : pos.index;
	const { files, failed } = usePageFiles(comic.id, archiveSource(comic), pages, archiveReady, around);

	// ---- page geometry ----
	const shape = useCallback(
		(index: number): { width: number | null; height: number | null } => {
			const f = files.get(index);
			return f ? f : (pages[index] ?? { width: null, height: null });
		},
		[files, pages],
	);
	const rotationOf = useCallback(
		(index: number): Rotation => {
			const page = pages[index];
			if (!page) {
				return 0;
			}
			const saved = sessionRotations.get(page.entryName) ?? savedRotations?.get(page.entryName);
			return effectiveRotation(saved, isSpread(shape(index), threshold), wideMode);
		},
		[pages, sessionRotations, savedRotations, shape, threshold, wideMode],
	);
	const nav = useMemo<Navigator>(
		() => ({
			count: pages.length,
			halves: i => usesHalves(isSpread(shape(i), threshold), rotationOf(i), wideMode),
		}),
		[pages.length, shape, threshold, rotationOf, wideMode],
	);

	const halves = nav.halves(pos.index);
	const part = halves ? (pos.part === 'whole' ? 'whole' : pos.part) : 'whole';
	const side = screenSide(part, direction);

	// ---- progress ----
	const opened = useRef(false);
	useEffect(() => {
		if (!opened.current) {
			opened.current = true;
			markOpened(comic.id, pos.index);
			return;
		}
		const t = setTimeout(() => saveProgress(comic.id, pos.index), 400);
		return () => clearTimeout(t);
	}, [comic.id, pos.index]);

	// ---- end of comic: offer the next one in its folder ----
	const finishComic = useCallback(async () => {
		await saveProgress(comic.id, pages.length - 1);
		const siblings = comic.folderId !== null ? await comicsInFolder(comic.folderId) : [];
		siblings.sort(readingOrder);
		const next = siblings[siblings.findIndex(c => c.id === comic.id) + 1];
		if (next && next.localState !== 'unavailable') {
			showSnackbar(`Finished. Next: ${next.title}`, { label: 'Read', onPress: () => onOpen(next.id) });
		} else {
			showSnackbar(siblings.length > 1 ? 'That was the last comic in this folder' : 'That was the last page');
		}
	}, [comic.id, comic.folderId, pages.length, onOpen]);

	// ---- navigation ----
	const goNext = useCallback(() => {
		const next = nextPosition({ index: pos.index, part: part === 'whole' && halves ? 'second' : pos.part }, nav);
		if (next) {
			setPos(next);
		} else {
			haptic('light');
			finishComic();
		}
	}, [pos, part, halves, nav, finishComic]);
	const goPrev = useCallback(() => {
		const prev = previousPosition({ index: pos.index, part: part === 'whole' && halves ? 'first' : pos.part }, nav);
		if (prev) {
			setPos(prev);
		} else {
			haptic('light');
		}
	}, [pos, part, halves, nav]);

	const rtl = direction === 'rtl';
	const onTap = useCallback(
		(x: number) => {
			if (x < W * 0.3) {
				rtl ? goNext() : goPrev();
			} else if (x > W * 0.7) {
				rtl ? goPrev() : goNext();
			} else {
				setChrome(c => !c);
			}
		},
		[W, rtl, goNext, goPrev],
	);
	const onSwipe = useCallback(
		(dir: 'left' | 'right') => ((dir === 'left') !== rtl ? goNext() : goPrev()),
		[rtl, goNext, goPrev],
	);
	const toggleWhole = useCallback(
		() => setPos(p => ({ index: p.index, part: p.part === 'whole' ? 'first' : 'whole' })),
		[],
	);

	const rotateTo = useCallback(
		(rotation: Rotation) => {
			const page = pages[pos.index];
			if (!page) {
				return;
			}
			setSessionRotations(prev => new Map(prev).set(page.entryName, rotation));
			if (rememberRotation) {
				setRotation(comic.id, page.entryName, rotation);
			}
			setPos(p => ({ index: p.index, part: 'first' }));
		},
		[pages, pos.index, rememberRotation, comic.id],
	);
	const rotation = rotationOf(pos.index);

	// ---- hint shown briefly when landing on a wide page ----
	const [hint, setHint] = useState<string | null>(null);
	useEffect(() => {
		if (!halves || part === 'whole') {
			setHint(rotation ? `Rotated ${rotation}° · saved for this page` : null);
			return;
		}
		const first = part === 'first';
		const sideName = side === 'left' ? 'Left' : 'Right';
		setHint(
			wideMode === 'split'
				? `Wide page · ${first ? 'part 1 of 2' : 'part 2 of 2'}`
				: first
					? `${sideName} half first · tap the edge for the other half`
					: `${sideName} half · next tap turns the page`,
		);
		const t = setTimeout(() => setHint(null), 2600);
		return () => clearTimeout(t);
	}, [pos.index, part, halves, side, rotation, wideMode]);

	const current = files.get(pos.index);
	const label = halves && part !== 'whole' ? `${pos.index + 1}${part === 'first' ? 'a' : 'b'}` : `${pos.index + 1}`;
	const streaming = downloadProgress !== undefined || !archiveReady;

	return (
		<View style={styles.black}>
			<StatusBar hidden={!chrome} barStyle="light-content" animated />

			{direction === 'vertical' ? (
				<VerticalPages
					pages={pages}
					files={files}
					width={W}
					initialIndex={pos.index}
					onIndex={index => setPos({ index, part: 'whole' })}
					onTap={() => setChrome(c => !c)}
				/>
			) : archiveReady || current ? (
				<PageView
					key={pos.index}
					path={current?.path}
					imageWidth={current?.width ?? pages[pos.index]?.width ?? W}
					imageHeight={current?.height ?? pages[pos.index]?.height ?? H}
					screenWidth={W}
					screenHeight={H}
					rotation={rotation}
					side={side}
					halvesPossible={halves}
					onTap={onTap}
					onSwipe={onSwipe}
					onToggleWhole={toggleWhole}
				/>
			) : (
				<FetchingPlaceholder comic={comic} progress={downloadProgress} error={loadError} />
			)}

			{failed && (
				<View style={styles.failed}>
					<Text variant="body" color="#FFDAD6">
						Some pages could not be read from this file.
					</Text>
				</View>
			)}

			{chrome && (
				<>
					<Animated.View
						entering={FadeIn.duration(150)}
						exiting={FadeOut.duration(150)}
						style={[styles.topBar, { paddingTop: insets.top + 4 }]}>
						<IconButton icon={ChevronLeft} label="Back" onPress={onClose} size={24} color="#E7E9EF" />
						<View style={styles.titleBox}>
							<Text variant="body" weight="bold" color="#E7E9EF" numberOfLines={1}>
								{comic.title}
							</Text>
							<Text variant="caption" color="#A3A9B6">
								Page {label} of {pages.length}
								{halves ? ' · wide page' : ''}
							</Text>
						</View>
						<IconButton
							icon={RotateCw}
							label="Rotate page"
							selected={rotation !== 0}
							color="#E7E9EF"
							onPress={() => rotateTo(((rotation + 90) % 360) as Rotation)}
						/>
						{(halves || (isSpread(shape(pos.index), threshold) && rotation === 0)) && (
							<IconButton
								icon={Columns2}
								label="Toggle whole spread"
								selected={part === 'whole'}
								color="#E7E9EF"
								onPress={toggleWhole}
							/>
						)}
						<IconButton
							icon={SlidersHorizontal}
							label="Reader settings"
							color="#E7E9EF"
							onPress={() => setSheet(true)}
						/>
					</Animated.View>

					{hint && (
						<Animated.View
							entering={FadeIn.duration(150)}
							exiting={FadeOut.duration(200)}
							pointerEvents="none"
							style={[styles.hintWrap, { top: insets.top + 72 }]}>
							<View style={styles.hint}>
								<View style={[styles.hintDot, { backgroundColor: theme.accent.primary }]} />
								<Text variant="caption" weight="semibold" color="#E7E9EF">
									{hint}
								</Text>
							</View>
						</Animated.View>
					)}

					<Animated.View
						entering={FadeIn.duration(150)}
						exiting={FadeOut.duration(150)}
						style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
						{streaming && archiveReady === false && (
							<View style={styles.streamRow}>
								<Download size={16} color="#C9CDD6" />
								<Text variant="caption" color="#C9CDD6">
									Fetching from {comic.sourceLabel ?? 'source'} · {Math.round((downloadProgress ?? 0) * 100)}%
								</Text>
							</View>
						)}
						<Scrubber
							count={pages.length}
							index={pos.index}
							ready={files.size}
							onSeek={index => setPos({ index, part: 'first' })}
							pageFile={index => files.get(index)}
							onPreview={setPreviewIndex}
						/>
					</Animated.View>
				</>
			)}

			<ReaderSheet
				visible={sheet}
				onClose={() => setSheet(false)}
				rotation={rotation}
				onRotation={rotateTo}
				wideMode={wideMode}
				onWideMode={mode => {
					setWideMode(mode);
					setPos(p => ({ index: p.index, part: mode === 'whole' ? 'whole' : 'first' }));
				}}
				direction={direction}
				onDirection={setDirection}
			/>
		</View>
	);
}

function FetchingPlaceholder({ comic, progress, error }: { comic: Comic; progress?: number; error: string | null }) {
	return (
		<View style={styles.fetching}>
			<Cover comic={comic} width={160} badges={false} />
			<Text variant="body" color="#E7E9EF">
				{error ? "Couldn't download this comic" : `Fetching from ${comic.sourceLabel ?? 'source'}`}
			</Text>
			{error ? (
				<Text variant="caption" color="#A3A9B6" style={styles.center}>
					{error}
				</Text>
			) : (
				<View style={styles.fetchBar}>
					<ProgressBar value={progress ?? 0} />
				</View>
			)}
		</View>
	);
}

/** Webtoon-style continuous scroll. Pages keep their aspect ratio at screen width. */
function VerticalPages({
	pages,
	files,
	width,
	initialIndex,
	onIndex,
	onTap,
}: {
	pages: Page[];
	files: Map<number, PageFile>;
	width: number;
	initialIndex: number;
	onIndex: (index: number) => void;
	onTap: () => void;
}) {
	const heightOf = (p: Page) => {
		const f = files.get(p.index);
		const w = f?.width ?? p.width;
		const h = f?.height ?? p.height;
		return w && h && w > 0 ? (width * h) / w : width * 1.5;
	};
	const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Page; isViewable: boolean }[] }) => {
		const first = viewableItems.find(v => v.isViewable);
		if (first?.item) {
			onIndex(first.item.index);
		}
	}).current;

	return (
		<FlatList
			data={pages}
			keyExtractor={p => String(p.index)}
			initialScrollIndex={initialIndex}
			getItemLayout={(_, i) => {
				let offset = 0;
				for (let k = 0; k < i; k++) {
					offset += heightOf(pages[k]);
				}
				return { length: heightOf(pages[i]), offset, index: i };
			}}
			onViewableItemsChanged={onViewable}
			viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
			windowSize={5}
			renderItem={({ item }) => {
				const f = files.get(item.index);
				return (
					<View
						style={{ width, height: heightOf(item) }}
						onTouchEnd={e => {
							if (e.nativeEvent.locationY >= 0) {
								onTap();
							}
						}}>
						{f ? (
							<Image source={{ uri: fileUri(f.path) }} style={StyleSheet.absoluteFill} resizeMode="contain" />
						) : null}
					</View>
				);
			}}
		/>
	);
}

const styles = StyleSheet.create({
	black: {
		flex: 1,
		backgroundColor: '#000',
	},
	topBar: {
		position: 'absolute',
		left: 0,
		right: 0,
		top: 0,
		paddingHorizontal: 4,
		paddingBottom: 8,
		flexDirection: 'row',
		alignItems: 'center',
		backgroundColor: 'rgba(16,18,22,0.94)',
	},
	titleBox: {
		flex: 1,
		paddingLeft: 2,
	},
	hintWrap: {
		position: 'absolute',
		left: 0,
		right: 0,
		alignItems: 'center',
	},
	hint: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 8,
		paddingHorizontal: 14,
		paddingVertical: 8,
		borderRadius: 18,
		backgroundColor: 'rgba(34,38,46,0.94)',
	},
	hintDot: {
		width: 8,
		height: 8,
		borderRadius: 4,
	},
	bottomBar: {
		position: 'absolute',
		left: 0,
		right: 0,
		bottom: 0,
		paddingTop: 12,
		paddingHorizontal: 16,
		gap: 12,
		backgroundColor: 'rgba(16,18,22,0.94)',
	},
	streamRow: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 10,
	},
	fetching: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 16,
		padding: 32,
	},
	fetchBar: {
		width: 200,
		flexDirection: 'row',
	},
	center: {
		textAlign: 'center',
	},
	failed: {
		position: 'absolute',
		left: 16,
		right: 16,
		bottom: 140,
		padding: 12,
		borderRadius: 12,
		backgroundColor: '#93000A',
	},
});
