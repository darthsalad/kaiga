import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture, useSimultaneousGestures, useTapGesture } from 'react-native-gesture-handler';
import { scheduleOnRN } from 'react-native-worklets';
import { Text } from '../../components/Text';
import { fileUri } from '../../storage/paths';
import { useTheme } from '../../theme/ThemeProvider';

type Props = {
	count: number;
	index: number;
	/** pages extracted so far, drawn as a lighter buffer behind the progress */
	ready: number;
	onSeek: (index: number) => void;
	/** the unpacked file for a page, if it is in the page cache yet */
	pageFile?: (index: number) => { path: string; width: number; height: number } | undefined;
	/** the page a paused drag rests on (null when the drag ends), so the reader can unpack it first */
	onPreview?: (index: number | null) => void;
};

const PREVIEW_MAX_W = 112;
const PREVIEW_MAX_H = 160;
/** how long a drag rests on a page before asking for it to be unpacked */
const PREVIEW_DELAY_MS = 100;

/** Page slider. Dragging shows the target page above the thumb and seeks on release. */
export function Scrubber({ count, index, ready, onSeek, pageFile, onPreview }: Props) {
	const theme = useTheme();
	const [width, setWidth] = useState(1);
	const [dragging, setDragging] = useState<number | null>(null);
	const shown = dragging ?? index;
	const fraction = count > 1 ? shown / (count - 1) : 1;

	useEffect(() => {
		if (dragging === null) {
			onPreview?.(null);
			return;
		}
		const t = setTimeout(() => onPreview?.(dragging), PREVIEW_DELAY_MS);
		return () => clearTimeout(t);
	}, [dragging, onPreview]);

	const preview = dragging !== null ? pageFile?.(dragging) : undefined;
	const scale = preview ? Math.min(PREVIEW_MAX_W / preview.width, PREVIEW_MAX_H / preview.height) : 0;
	const previewW = preview ? preview.width * scale : 48;
	const previewLeft = Math.min(width - previewW, Math.max(0, fraction * width - previewW / 2));

	const pageAt = (x: number) => {
		'worklet';
		return Math.round(Math.min(1, Math.max(0, x / width)) * (count - 1));
	};

	const pan = usePanGesture({
		minDistance: 2,
		onBegin: e => {
			scheduleOnRN(setDragging, pageAt(e.x));
		},
		onUpdate: e => {
			scheduleOnRN(setDragging, pageAt(e.x));
		},
		onFinalize: e => {
			scheduleOnRN(onSeek, pageAt(e.x));
			scheduleOnRN(setDragging, null);
		},
	});
	const tap = useTapGesture({
		onActivate: e => {
			scheduleOnRN(onSeek, pageAt(e.x));
		},
	});
	const gesture = useSimultaneousGestures(pan, tap);

	return (
		<View style={styles.row}>
			<Text variant="caption" weight="bold" color="#E7E9EF" style={styles.num}>
				{shown + 1}
			</Text>
			<GestureDetector gesture={gesture}>
				<View
					style={styles.hit}
					onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
					accessible
					accessibilityRole="adjustable"
					accessibilityLabel="Page"
					accessibilityValue={{ min: 1, max: count, now: shown + 1 }}
					accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
					onAccessibilityAction={e =>
						onSeek(Math.max(0, Math.min(count - 1, index + (e.nativeEvent.actionName === 'increment' ? 1 : -1))))
					}>
					<View style={[styles.track, { backgroundColor: '#2D323C' }]}>
						<View
							style={[styles.fill, { width: `${(ready / Math.max(1, count)) * 100}%`, backgroundColor: '#4A5160' }]}
						/>
						<View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: theme.accent.primary }]} />
					</View>
					<View
						style={[
							styles.thumb,
							{ left: fraction * width - 9, backgroundColor: theme.accent.primary },
							dragging !== null && styles.thumbActive,
						]}
					/>
					{dragging !== null && (
						<View pointerEvents="none" style={[styles.preview, { left: previewLeft }]}>
							{preview && (
								<Image
									source={{ uri: fileUri(preview.path) }}
									resizeMethod="resize"
									style={{ width: previewW, height: preview.height * scale }}
								/>
							)}
							<Text variant="caption" weight="bold" color="#E7E9EF" style={styles.previewNum}>
								{dragging + 1}
							</Text>
						</View>
					)}
				</View>
			</GestureDetector>
			<Text variant="caption" color="#A3A9B6" style={[styles.num, styles.right]}>
				{count}
			</Text>
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
	},
	num: {
		width: 34,
	},
	right: {
		textAlign: 'right',
	},
	hit: {
		flex: 1,
		height: 32,
		justifyContent: 'center',
	},
	track: {
		height: 6,
		borderRadius: 3,
		overflow: 'hidden',
	},
	fill: {
		position: 'absolute',
		left: 0,
		top: 0,
		bottom: 0,
		borderRadius: 3,
	},
	thumb: {
		position: 'absolute',
		top: 7,
		width: 18,
		height: 18,
		borderRadius: 9,
	},
	thumbActive: {
		transform: [{ scale: 1.25 }],
	},
	preview: {
		position: 'absolute',
		bottom: 40,
		minWidth: 48,
		borderRadius: 10,
		backgroundColor: '#1D2027',
		overflow: 'hidden',
		alignItems: 'center',
	},
	previewNum: {
		paddingVertical: 4,
	},
});
