import React from 'react';
import { FlatList, Linking, Pressable, StyleSheet, View } from 'react-native';
import { ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppIcon } from '../../components/AppIcon';
import { IconButton } from '../../components/IconButton';
import { Text } from '../../components/Text';
import type { RootScreenProps } from '../../navigation/types';
import { useTheme } from '../../theme/ThemeProvider';
import { radius } from '../../theme/tokens';
import { components } from './licenses';

const [kaiga, ...others] = components;

export function AboutScreen({ navigation }: RootScreenProps<'About'>) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	return (
		<FlatList
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]}
			data={others}
			keyExtractor={c => c.name}
			ListHeaderComponent={
				<View style={styles.head}>
					<IconButton icon={ChevronLeft} label="Back" size={24} onPress={() => navigation.goBack()} />
					<View style={styles.hero}>
						<AppIcon size={88} />
						<Text variant="display">Kaiga</Text>
						<Text variant="caption" muted>
							Version {kaiga.version}
						</Text>
						<Text variant="body" muted style={styles.blurb}>
							A comic reader for CBZ, CBR and CB7. No accounts, no ads, no analytics and no network access.
						</Text>
					</View>
					<View style={[styles.card, { backgroundColor: theme.surface }]}>
						<Pressable
							accessibilityRole="link"
							onPress={() => Linking.openURL(kaiga.url)}
							android_ripple={{ color: theme.surfaceHigh }}
							style={styles.row}>
							<View style={styles.flex}>
								<Text variant="body">Source code</Text>
								<Text variant="caption" muted numberOfLines={1}>
									{kaiga.url.replace(/^https:\/\//, '')}
								</Text>
							</View>
							<ExternalLink size={18} color={theme.textMuted} />
						</Pressable>
						<View style={[styles.divider, { backgroundColor: theme.outlineVariant }]} />
						<Pressable
							accessibilityRole="button"
							onPress={() => navigation.navigate('License', { index: 0 })}
							android_ripple={{ color: theme.surfaceHigh }}
							style={styles.row}>
							<View style={styles.flex}>
								<Text variant="body">License</Text>
								<Text variant="caption" muted>
									GNU GPL v3.0 or later
								</Text>
							</View>
							<ChevronRight size={18} color={theme.textMuted} />
						</Pressable>
					</View>
					<Text variant="label" weight="bold" color={theme.accent.primary} style={styles.sectionTitle}>
						Open-source licenses
					</Text>
				</View>
			}
			renderItem={({ item, index }) => (
				<Pressable
					accessibilityRole="button"
					accessibilityLabel={`${item.name}, ${item.license}`}
					onPress={() => navigation.navigate('License', { index: index + 1 })}
					android_ripple={{ color: theme.surfaceHigh }}
					style={styles.row}>
					<View style={styles.flex}>
						<Text variant="body" numberOfLines={1}>
							{item.name}
						</Text>
						<Text variant="caption" muted numberOfLines={1}>
							{item.version ? `${item.version} · ` : ''}
							{item.license}
						</Text>
					</View>
					<ChevronRight size={18} color={theme.textMuted} />
				</Pressable>
			)}
		/>
	);
}

export function LicenseScreen({ navigation, route }: RootScreenProps<'License'>) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	const component = components[route.params.index];
	// long texts render in chunks: one huge Text is slow to lay out
	const paragraphs = component.text.split(/\n{2,}/);
	return (
		<FlatList
			style={{ backgroundColor: theme.background }}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + 4, paddingBottom: insets.bottom + 24 }]}
			data={paragraphs}
			keyExtractor={(_, i) => String(i)}
			ListHeaderComponent={
				<View style={styles.head}>
					<IconButton icon={ChevronLeft} label="Back" size={24} onPress={() => navigation.goBack()} />
					<Text variant="headline">{component.name}</Text>
					<Text variant="caption" muted>
						{component.version ? `${component.version} · ` : ''}
						{component.license}
					</Text>
				</View>
			}
			renderItem={({ item }) => (
				<Text variant="caption" style={styles.paragraph} selectable>
					{item}
				</Text>
			)}
		/>
	);
}

const styles = StyleSheet.create({
	content: {
		paddingHorizontal: 16,
	},
	head: {
		gap: 8,
		paddingBottom: 12,
		alignItems: 'flex-start',
	},
	hero: {
		alignSelf: 'stretch',
		alignItems: 'center',
		gap: 6,
		paddingVertical: 16,
	},
	blurb: {
		textAlign: 'center',
		marginTop: 6,
		paddingHorizontal: 12,
	},
	card: {
		alignSelf: 'stretch',
		borderRadius: radius.xl,
		overflow: 'hidden',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		gap: 12,
		paddingVertical: 12,
		paddingHorizontal: 16,
	},
	flex: {
		flex: 1,
	},
	divider: {
		height: StyleSheet.hairlineWidth,
		marginHorizontal: 16,
	},
	sectionTitle: {
		marginTop: 16,
		marginLeft: 4,
	},
	paragraph: {
		marginBottom: 12,
	},
});
