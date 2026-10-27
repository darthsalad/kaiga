export function formatBytes(bytes: number) {
	if (bytes < 1024) {
		return `${bytes} B`;
	}
	const units = ['KB', 'MB', 'GB', 'TB'];
	let value = bytes / 1024;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	return `${value >= 100 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

const DAY = 24 * 60 * 60 * 1000;

function startOfDay(t: number) {
	const d = new Date(t);
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

export function historyGroup(t: number, now = Date.now()): 'Today' | 'Yesterday' | 'This week' | 'Earlier' {
	const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
	if (days <= 0) {
		return 'Today';
	}
	if (days === 1) {
		return 'Yesterday';
	}
	return days < 7 ? 'This week' : 'Earlier';
}

export function formatTime(t: number, now = Date.now()) {
	const d = new Date(t);
	const group = historyGroup(t, now);
	if (group === 'Today' || group === 'Yesterday') {
		return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	}
	if (group === 'This week') {
		return d.toLocaleDateString(undefined, { weekday: 'short' });
	}
	return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function formatRelative(t: number, now = Date.now()) {
	const group = historyGroup(t, now);
	if (group === 'Today') {
		return 'today';
	}
	if (group === 'Yesterday') {
		return 'yesterday';
	}
	const days = Math.round((startOfDay(now) - startOfDay(t)) / DAY);
	return `${days} days ago`;
}

export function formatDate(t: number) {
	return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Friendly name for the app that provided a picked file. */
export function sourceLabelFor(authority: string) {
	if (authority.startsWith('com.google.android.apps.docs')) {
		return 'Google Drive';
	}
	if (authority === 'com.android.externalstorage.documents') {
		return 'Phone storage';
	}
	if (authority === 'com.android.providers.downloads.documents') {
		return 'Downloads';
	}
	if (authority.includes('dropbox')) {
		return 'Dropbox';
	}
	if (authority.includes('skydrive') || authority.includes('onedrive')) {
		return 'OneDrive';
	}
	return 'Files';
}

const ON_PHONE = new Set([
	'com.android.externalstorage.documents',
	'com.android.providers.downloads.documents',
	'com.android.providers.media.documents',
	'media',
]);

/** Files already on the phone are read in place; anything else is copied so it reads offline. */
export function storageFor(authority: string): 'copy' | 'direct' {
	return ON_PHONE.has(authority) ? 'direct' : 'copy';
}

export function authorityOf(uri: string) {
	const match = /^content:\/\/([^/]+)/.exec(uri);
	return match ? decodeURIComponent(match[1]) : '';
}
