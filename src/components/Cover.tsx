import React from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AlertCircle, Cloud, Pin } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import type { Comic } from '../db/comics';
import { useDownloadProgress } from '../services/jobs';
import { fileUri } from '../storage/paths';
import { useTheme } from '../theme/ThemeProvider';
import { Text } from './Text';

type Props = {
	comic: Comic;
	width: number;
	radius?: number;
	badges?: boolean;
	style?: StyleProp<ViewStyle>;
};

export function Cover({ comic, width, radius = 14, badges = true, style }: Props) {
	const theme = useTheme();
	const height = width * 1.5;
	return (
		<View
			style={[
				styles.cover,
				{ width, height, borderRadius: radius, backgroundColor: comic.coverColor ?? theme.surfaceHigh },
				style,
			]}>
			{comic.coverPath ? (
				<Image
					source={{ uri: fileUri(comic.coverPath, comic.coverVersion) }}
					style={StyleSheet.absoluteFill}
					resizeMode="cover"
					accessibilityIgnoresInvertColors
				/>
			) : (
				<Text variant="label" weight="bold" style={styles.placeholder} numberOfLines={4}>
					{comic.title}
				</Text>
			)}
			{badges && comic.bookmarked && (
				<View accessibilityLabel="Bookmarked" style={[styles.ribbon, { backgroundColor: theme.accent.primary }]}>
					<View style={[styles.ribbonNotch, { borderBottomColor: comic.coverColor ?? theme.surfaceHigh }]} />
				</View>
			)}
			{badges && <StateBadge comic={comic} />}
		</View>
	);
}

function StateBadge({ comic }: { comic: Comic }) {
	const theme = useTheme();
	const progress = useDownloadProgress(comic.id);
	const bg = { backgroundColor: 'rgba(16,18,22,0.78)' };

	if (progress !== undefined || comic.localState === 'queued' || comic.localState === 'downloading') {
		const r = 8;
		const c = 2 * Math.PI * r;
		return (
			<View style={[styles.badge, bg]} accessibilityLabel={`Downloading ${Math.round((progress ?? 0) * 100)}%`}>
				<Svg width={20} height={20} viewBox="0 0 22 22">
					<Circle cx={11} cy={11} r={r} stroke="#3A404B" strokeWidth={3} fill="none" />
					<Circle
						cx={11}
						cy={11}
						r={r}
						stroke={theme.accent.primary}
						strokeWidth={3}
						fill="none"
						strokeLinecap="round"
						strokeDasharray={`${(progress ?? 0) * c} ${c}`}
						transform="rotate(-90 11 11)"
					/>
				</Svg>
			</View>
		);
	}
	if (comic.localState === 'evicted') {
		return (
			<View style={[styles.badge, bg]} accessibilityLabel="Not on phone, opens from source">
				<Cloud size={15} color="#E7E9EF" strokeWidth={2.2} />
			</View>
		);
	}
	if (comic.localState === 'error' || comic.localState === 'unavailable') {
		return (
			<View style={[styles.badge, { backgroundColor: theme.errorContainer }]} accessibilityLabel="Problem with file">
				<AlertCircle size={15} color={theme.onErrorContainer} strokeWidth={2.2} />
			</View>
		);
	}
	if (comic.keepOffline) {
		return (
			<View style={[styles.badge, { backgroundColor: theme.accent.primary }]} accessibilityLabel="Kept offline">
				<Pin size={14} color={theme.accent.onPrimary} strokeWidth={2.4} />
			</View>
		);
	}
	return null;
}

const styles = StyleSheet.create({
	cover: {
		overflow: 'hidden',
	},
	placeholder: {
		position: 'absolute',
		left: 8,
		right: 8,
		bottom: 8,
	},
	badge: {
		position: 'absolute',
		top: 6,
		right: 6,
		width: 26,
		height: 26,
		borderRadius: 13,
		alignItems: 'center',
		justifyContent: 'center',
	},
	ribbon: {
		position: 'absolute',
		left: 8,
		top: 0,
		width: 14,
		height: 22,
		alignItems: 'center',
		justifyContent: 'flex-end',
	},
	ribbonNotch: {
		width: 0,
		height: 0,
		borderLeftWidth: 7,
		borderRightWidth: 7,
		borderBottomWidth: 6,
		borderLeftColor: 'transparent',
		borderRightColor: 'transparent',
	},
});
