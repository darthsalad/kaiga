import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type Dirs = {
	files: string;
	cache: string;
};

export type UriInfo = {
	name: string;
	size: number;
	lastModified: number;
	authority: string;
};

export type TreeFile = {
	uri: string;
	documentId: string;
	name: string;
	/** path inside the picked folder, '/'-separated, ending with the file name */
	path: string;
	size: number;
	lastModified: number;
};

export type ArchiveEntry = {
	name: string;
	size: number;
};

export type ArchiveListing = {
	format: string;
	entries: ArchiveEntry[];
};

/** ComicInfo.xml fields, as written in the file; missing ones are empty strings */
export type ComicInfo = {
	title: string;
	series: string;
	number: string;
	count: string;
	volume: string;
	year: string;
	month: string;
	summary: string;
	notes: string;
	writer: string;
	penciller: string;
	inker: string;
	coverArtist: string;
	publisher: string;
	genre: string;
	manga: string;
	languageIso: string;
};

export type ImageSize = {
	width: number;
	height: number;
};

export type Thumbnail = {
	width: number;
	height: number;
	color: string;
};

export type CopyProgress = {
	jobId: string;
	bytes: number;
	total: number;
};

export type PageExtracted = {
	jobId: string;
	name: string;
	path: string;
	width: number;
	height: number;
};

export type DynamicAccent = {
	primaryDark: string;
	onPrimaryDark: string;
	containerDark: string;
	onContainerDark: string;
	primaryLight: string;
	onPrimaryLight: string;
	containerLight: string;
	onContainerLight: string;
};

export interface Spec extends TurboModule {
	/** Lets the launch screen go; call once the first real screen has been drawn. */
	hideSplash(): void;
	setKeepScreenOn(on: boolean): void;
	/** 'light' for a short tick, 'long' for a long press */
	haptic(kind: string): void;
	getDirs(): Dirs;
	getDynamicAccent(): DynamicAccent | null;

	queryUri(uri: string): Promise<UriInfo>;
	hasUriPermission(uri: string): boolean;
	releaseUriPermission(uri: string): void;
	copyUri(jobId: string, uri: string, destPath: string): Promise<number>;
	cancelJob(jobId: string): void;
	listTree(treeUri: string): Promise<TreeFile[]>;

	listArchive(path: string): Promise<ArchiveListing>;
	readComicInfo(archivePath: string, entryName: string): Promise<ComicInfo>;
	extractEntries(jobId: string, archivePath: string, names: string[], destPaths: string[]): Promise<void>;
	makeThumbnail(srcPath: string, destPath: string, maxWidth: number): Promise<Thumbnail>;
	imageSize(path: string): Promise<ImageSize>;

	pathExists(path: string): boolean;
	pathSize(path: string): Promise<number>;
	deletePath(path: string): Promise<void>;

	readonly onCopyProgress: CodegenTypes.EventEmitter<CopyProgress>;
	readonly onPageExtracted: CodegenTypes.EventEmitter<PageExtracted>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('KaigaNative');
