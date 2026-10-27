import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BookOpen, History, Settings, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '../components/Text';
import { AboutScreen, LicenseScreen } from '../features/about/AboutScreen';
import { DetailScreen } from '../features/detail/DetailScreen';
import { FolderScreen } from '../features/folder/FolderScreen';
import { HistoryScreen } from '../features/history/HistoryScreen';
import { LibraryScreen } from '../features/library/LibraryScreen';
import { ReaderScreen } from '../features/reader/ReaderScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { useTheme } from '../theme/ThemeProvider';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const tabIcons: Record<keyof TabParamList, LucideIcon> = {
	Library: BookOpen,
	History: History,
	Settings: Settings,
};

function TabBar({ state, navigation }: BottomTabBarProps) {
	const theme = useTheme();
	const insets = useSafeAreaInsets();
	return (
		<View
			accessibilityRole="tablist"
			style={[styles.tabBar, { backgroundColor: theme.surface, paddingBottom: 8 + insets.bottom }]}>
			{state.routes.map((route, index) => {
				const focused = state.index === index;
				const Icon = tabIcons[route.name as keyof TabParamList];
				return (
					<Pressable
						key={route.key}
						accessibilityRole="tab"
						accessibilityState={{ selected: focused }}
						accessibilityLabel={route.name}
						style={styles.tab}
						onPress={() => {
							const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
							if (!focused && !event.defaultPrevented) {
								navigation.navigate(route.name);
							}
						}}>
						<View style={[styles.pill, focused && { backgroundColor: theme.accent.container }]}>
							<Icon size={22} color={focused ? theme.accent.onContainer : theme.textMuted} strokeWidth={2} />
						</View>
						<Text variant="caption" weight={focused ? 'bold' : 'semibold'} muted={!focused}>
							{route.name}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const renderTabBar = (props: BottomTabBarProps) => <TabBar {...props} />;

function Tabs() {
	return (
		<Tab.Navigator screenOptions={{ headerShown: false }} tabBar={renderTabBar}>
			<Tab.Screen name="Library" component={LibraryScreen} />
			<Tab.Screen name="History" component={HistoryScreen} />
			<Tab.Screen name="Settings" component={SettingsScreen} />
		</Tab.Navigator>
	);
}

export function RootNavigator() {
	const theme = useTheme();
	return (
		<Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background } }}>
			<Stack.Screen name="Tabs" component={Tabs} />
			<Stack.Screen name="Detail" component={DetailScreen} options={{ animation: 'fade_from_bottom' }} />
			<Stack.Screen name="Folder" component={FolderScreen} options={{ animation: 'fade_from_bottom' }} />
			<Stack.Screen
				name="Reader"
				component={ReaderScreen}
				options={{ animation: 'fade', contentStyle: { backgroundColor: '#000' } }}
			/>
			<Stack.Screen name="About" component={AboutScreen} />
			<Stack.Screen name="License" component={LicenseScreen} />
		</Stack.Navigator>
	);
}

const styles = StyleSheet.create({
	tabBar: {
		flexDirection: 'row',
		paddingTop: 12,
	},
	tab: {
		flex: 1,
		alignItems: 'center',
		gap: 4,
	},
	// Material 3 active indicator: a 64x32 fully rounded pill
	pill: {
		width: 64,
		height: 32,
		borderRadius: 16,
		overflow: 'hidden',
		alignItems: 'center',
		justifyContent: 'center',
	},
});
