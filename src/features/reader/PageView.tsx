import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import {
	GestureDetector,
	useExclusiveGestures,
	usePanGesture,
	usePinchGesture,
	useSimultaneousGestures,
	useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import type { Rotation } from '../../db/comics';
import { fileUri } from '../../storage/paths';
import { Text } from '../../components/Text';
import { fitPage } from './layout';

type Props = {
	path: string | undefined;
	imageWidth: number;
	imageHeight: number;
	screenWidth: number;
	screenHeight: number;
	rotation: Rotation;
	side: 'left' | 'right' | 'whole';
	halvesPossible: boolean;
	onTap: (x: number) => void;
	onSwipe: (direction: 'left' | 'right') => void;
	onToggleWhole: () => void;
};

const MAX_ZOOM = 5;
const timing = { duration: 280 };

/**
 * One page with pinch-zoom, pan, double-tap and swipe. Halves, whole-spread and rotation are
 * applied as animated transforms over a single laid-out image (see fitPage).
 */
export function PageView(props: Props) {
	const { path, imageWidth, imageHeight, screenWidth: W, screenHeight: H, rotation, side, halvesPossible } = props;
	const { onTap, onSwipe, onToggleWhole } = props;
	const fit = fitPage(imageWidth, imageHeight, W, H, rotation, side, halvesPossible);
	const [hiRes, setHiRes] = useState(false);

	const baseScale = useSharedValue(fit.scale);
	const baseTx = useSharedValue(fit.translateX);
	const rotate = useSharedValue<number>(rotation);
	const zoom = useSharedValue(1);
	const tx = useSharedValue(0);
	const ty = useSharedValue(0);
	const swipe = useSharedValue(0);
	const start = useSharedValue({ zoom: 1, tx: 0, ty: 0 });
	// content size on screen before user zoom, rotation applied
	const sideways = rotation === 90 || rotation === 270;
	const contentW = useSharedValue((sideways ? fit.height : fit.width) * fit.scale);
	const contentH = useSharedValue((sideways ? fit.width : fit.height) * fit.scale);

	useEffect(() => {
		baseScale.value = withTiming(fit.scale, timing);
		baseTx.value = withTiming(fit.translateX, timing);
		contentW.value = (sideways ? fit.height : fit.width) * fit.scale;
		contentH.value = (sideways ? fit.width : fit.height) * fit.scale;
		// turn the short way round: 270 -> 0 animates to 360, not back through 180
		const current = rotate.value;
		const delta = ((((rotation - current) % 360) + 540) % 360) - 180;
		rotate.value = withTiming(current + delta, timing);
		zoom.value = withTiming(1, timing);
		tx.value = withTiming(0, timing);
		ty.value = withTiming(0, timing);
	}, [
		fit.scale,
		fit.translateX,
		fit.width,
		fit.height,
		sideways,
		rotation,
		baseScale,
		baseTx,
		contentW,
		contentH,
		rotate,
		zoom,
		tx,
		ty,
	]);

	const clampTranslation = (value: number, content: number, viewport: number, offset: number, scale: number) => {
		'worklet';
		const slack = Math.max(0, (content * scale - viewport) / 2);
		return Math.min(slack - offset * scale, Math.max(-slack - offset * scale, value));
	};

	const pinch = usePinchGesture({
		onActivate: () => {
			start.value = { zoom: zoom.value, tx: tx.value, ty: ty.value };
		},
		onUpdate: e => {
			const next = Math.min(MAX_ZOOM * 1.2, Math.max(0.8, start.value.zoom * e.scale));
			const k = next / start.value.zoom;
			// keep the point under the fingers still
			const fx = e.focalX - W / 2;
			const fy = e.focalY - H / 2;
			tx.value = fx - (fx - start.value.tx) * k;
			ty.value = fy - (fy - start.value.ty) * k;
			zoom.value = next;
		},
		onDeactivate: () => {
			const z = Math.min(MAX_ZOOM, Math.max(1, zoom.value));
			zoom.value = withTiming(z, timing);
			if (z <= 1.01) {
				tx.value = withTiming(0, timing);
				ty.value = withTiming(0, timing);
			} else {
				tx.value = withTiming(clampTranslation(tx.value, contentW.value, W, baseTx.value, z), timing);
				ty.value = withTiming(clampTranslation(ty.value, contentH.value, H, 0, z), timing);
			}
			scheduleOnRN(setHiRes, z > 1.4);
		},
	});

	const pan = usePanGesture({
		minDistance: 12,
		onActivate: () => {
			start.value = { zoom: zoom.value, tx: tx.value, ty: ty.value };
		},
		onUpdate: e => {
			if (zoom.value > 1.01) {
				tx.value = clampTranslation(start.value.tx + e.translationX, contentW.value, W, baseTx.value, zoom.value);
				ty.value = clampTranslation(start.value.ty + e.translationY, contentH.value, H, 0, zoom.value);
			} else {
				swipe.value = e.translationX;
			}
		},
		onDeactivate: e => {
			if (zoom.value > 1.01) {
				return;
			}
			const far = Math.abs(e.translationX) > W * 0.18 || Math.abs(e.velocityX) > 800;
			if (far && Math.abs(e.translationX) > Math.abs(e.translationY)) {
				scheduleOnRN(onSwipe, e.translationX < 0 ? 'left' : 'right');
			}
			swipe.value = withSpring(0, { damping: 20, stiffness: 220 });
		},
	});

	const doubleTap = useTapGesture({
		numberOfTaps: 2,
		maxDelay: 250,
		onActivate: e => {
			if (zoom.value > 1.01) {
				zoom.value = withTiming(1, timing);
				tx.value = withTiming(0, timing);
				ty.value = withTiming(0, timing);
				scheduleOnRN(setHiRes, false);
			} else if (halvesPossible) {
				scheduleOnRN(onToggleWhole);
			} else {
				const z = 2.5;
				zoom.value = withTiming(z, timing);
				tx.value = withTiming(clampTranslation(-(e.x - W / 2) * (z - 1), contentW.value, W, baseTx.value, z), timing);
				ty.value = withTiming(clampTranslation(-(e.y - H / 2) * (z - 1), contentH.value, H, 0, z), timing);
				scheduleOnRN(setHiRes, true);
			}
		},
	});

	const singleTap = useTapGesture({
		onActivate: e => {
			scheduleOnRN(onTap, e.x);
		},
	});

	const taps = useExclusiveGestures(doubleTap, singleTap);
	const gesture = useSimultaneousGestures(pinch, pan, taps);

	const animated = useAnimatedStyle(() => ({
		transform: [
			{ translateX: swipe.value + tx.value },
			{ translateY: ty.value },
			{ scale: zoom.value },
			{ translateX: baseTx.value },
			{ scale: baseScale.value },
			{ rotate: `${rotate.value}deg` },
		],
	}));

	return (
		<GestureDetector gesture={gesture}>
			<View style={[styles.viewport, { width: W, height: H }]} collapsable={false}>
				{path ? (
					<Animated.View
						style={[
							styles.page,
							{ width: fit.width, height: fit.height, left: (W - fit.width) / 2, top: (H - fit.height) / 2 },
							animated,
						]}>
						<Image
							source={{ uri: fileUri(path) }}
							style={StyleSheet.absoluteFill}
							resizeMode="contain"
							resizeMethod={hiRes ? 'scale' : 'resize'}
							fadeDuration={0}
						/>
					</Animated.View>
				) : (
					<View style={styles.loading}>
						<ActivityIndicator color="#A3A9B6" />
						<Text variant="caption" color="#A3A9B6">
							Preparing page…
						</Text>
					</View>
				)}
			</View>
		</GestureDetector>
	);
}

const styles = StyleSheet.create({
	viewport: {
		overflow: 'hidden',
		backgroundColor: '#000',
	},
	page: {
		position: 'absolute',
	},
	loading: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 10,
	},
});
