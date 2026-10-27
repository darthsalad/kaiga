import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useState } from 'react';
import { BackHandler, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeProvider';
import { radius } from '../theme/tokens';

type Host = {
	mount: (id: string, node: React.ReactNode) => void;
	unmount: (id: string) => void;
};

const HostContext = createContext<Host | null>(null);

/**
 * Draws every open sheet above the app. Sheets render here rather than in a Modal: on Android a
 * Modal's first frame is laid out before its window reaches full size, so the sheet jumps.
 */
export function SheetHost({ children }: { children: React.ReactNode }) {
	const [nodes, setNodes] = useState<Map<string, React.ReactNode>>(() => new Map());
	const host = useMemo<Host>(
		() => ({
			mount: (id, node) => setNodes(prev => new Map(prev).set(id, node)),
			unmount: id =>
				setNodes(prev => {
					const next = new Map(prev);
					next.delete(id);
					return next;
				}),
		}),
		[],
	);
	return (
		<HostContext.Provider value={host}>
			{children}
			{[...nodes].map(([id, node]) => (
				<React.Fragment key={id}>{node}</React.Fragment>
			))}
		</HostContext.Provider>
	);
}

/** A bottom sheet over a dimmed scrim. Tapping the scrim or pressing back closes it. */
export function Sheet({
	visible,
	onClose,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	children: React.ReactNode;
}) {
	const host = useContext(HostContext);
	const id = useId();
	const node = (
		<SheetView visible={visible} onClose={onClose}>
			{children}
		</SheetView>
	);
	// hand the latest content to the host on every render
	useLayoutEffect(() => host?.mount(id, node));
	useLayoutEffect(() => () => host?.unmount(id), [host, id]);
	if (!host) {
		throw new Error('Sheet needs a SheetHost above it');
	}
	return null;
}

function SheetView({
	visible,
	onClose,
	children,
}: {
	visible: boolean;
	onClose: () => void;
	children: React.ReactNode;
}) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const keyboard = useKeyboardHeight();

	useEffect(() => {
		if (!visible) {
			return;
		}
		const sub = BackHandler.addEventListener('hardwareBackPress', () => {
			onClose();
			return true;
		});
		return () => sub.remove();
	}, [visible, onClose]);

	if (!visible) {
		return null;
	}
	// no wrapping view: the exit animations only run when the animated views themselves unmount
	return (
		<>
			<Animated.View
				entering={FadeIn.duration(180)}
				exiting={FadeOut.duration(180)}
				style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }]}>
				<Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
			</Animated.View>
			<Animated.View
				entering={SlideInDown.duration(220)}
				exiting={SlideOutDown.duration(180)}
				accessibilityViewIsModal
				style={[
					styles.sheet,
					{
						backgroundColor: theme.dark ? '#1D2027' : theme.surface,
						bottom: keyboard,
						paddingBottom: 24 + (keyboard > 0 ? 0 : insets.bottom),
					},
				]}>
				<View style={[styles.handle, { backgroundColor: theme.outline }]} />
				{children}
			</Animated.View>
		</>
	);
}

/** The app draws edge to edge, so the window does not shrink for the keyboard; move above it instead. */
function useKeyboardHeight() {
	const [height, setHeight] = useState(0);
	useEffect(() => {
		const show = Keyboard.addListener('keyboardDidShow', e => setHeight(e.endCoordinates.height));
		const hide = Keyboard.addListener('keyboardDidHide', () => setHeight(0));
		return () => {
			show.remove();
			hide.remove();
		};
	}, []);
	return height;
}

const styles = StyleSheet.create({
	sheet: {
		position: 'absolute',
		left: 0,
		right: 0,
		borderTopLeftRadius: radius.xxl,
		borderTopRightRadius: radius.xxl,
		paddingHorizontal: 20,
		paddingTop: 10,
		gap: 20,
	},
	handle: {
		width: 36,
		height: 4,
		borderRadius: 2,
		alignSelf: 'center',
	},
});
