import type { NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps } from '@react-navigation/native';

export type TabParamList = {
	Library: undefined;
	History: undefined;
	Settings: undefined;
};

export type RootStackParamList = {
	Tabs: NavigatorScreenParams<TabParamList>;
	Detail: { comicId: number };
	Folder: { folderId: number };
	Reader: { comicId: number };
	About: undefined;
	/** index into the About screen's license list */
	License: { index: number };
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
	BottomTabScreenProps<TabParamList, T>,
	NativeStackScreenProps<RootStackParamList>
>;

declare global {
	namespace ReactNavigation {
		interface RootParamList extends RootStackParamList {}
	}
}
