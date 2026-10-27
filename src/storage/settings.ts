import { useCallback, useSyncExternalStore } from 'react';
import { createMMKV } from 'react-native-mmkv';

export type ReadingDirection = 'ltr' | 'rtl' | 'vertical';
export type WideMode = 'zoom' | 'whole' | 'split' | 'rotate';
export type ThemeMode = 'system' | 'light' | 'dark';

export type Settings = {
	readingDirection: ReadingDirection;
	wideMode: WideMode;
	/** a page counts as a two-page spread when width / height is at least this */
	wideThreshold: number;
	rememberRotation: boolean;
	evictionDays: number;
	themeMode: ThemeMode;
	dynamicColor: boolean;
	coverTint: boolean;
	/** keep comics whose file vanished from a watched folder, marked missing, instead of removing them */
	keepMissing: boolean;
	/** stop the screen from turning off while a comic is open */
	keepScreenOn: boolean;
	/** how many recently read comics keep their extracted pages */
	pageCacheComics: number;
	haptics: boolean;
};

export const defaultSettings: Settings = {
	readingDirection: 'ltr',
	wideMode: 'zoom',
	wideThreshold: 1.0,
	rememberRotation: true,
	evictionDays: 7,
	themeMode: 'system',
	dynamicColor: true,
	coverTint: true,
	keepMissing: true,
	keepScreenOn: true,
	pageCacheComics: 3,
	haptics: true,
};

const storage = createMMKV({ id: 'settings' });
const listeners = new Set<() => void>();

export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
	const raw = storage.getString(key);
	if (raw === undefined) {
		return defaultSettings[key];
	}
	try {
		return JSON.parse(raw) as Settings[K];
	} catch {
		return defaultSettings[key];
	}
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]) {
	storage.set(key, JSON.stringify(value));
	listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

export function useSetting<K extends keyof Settings>(key: K): [Settings[K], (value: Settings[K]) => void] {
	const value = useSyncExternalStore(subscribe, () => getSetting(key));
	const set = useCallback((next: Settings[K]) => setSetting(key, next), [key]);
	return [value, set];
}
