import NativeKaiga from './specs/NativeKaiga';

export type {
	ArchiveEntry,
	ArchiveListing,
	ComicInfo,
	CopyProgress,
	DynamicAccent,
	PageExtracted,
	Thumbnail,
	TreeFile,
	UriInfo,
} from './specs/NativeKaiga';

export const Kaiga = NativeKaiga;

/** Error codes the native module rejects with. */
export type KaigaErrorCode = 'E_CANCELLED' | 'E_NO_ACCESS' | 'E_NOT_FOUND' | 'E_ARCHIVE' | 'E_FAILED';

export function errorCode(err: unknown): KaigaErrorCode | undefined {
	if (err && typeof err === 'object' && 'code' in err && typeof err.code === 'string') {
		return err.code as KaigaErrorCode;
	}
	return undefined;
}

export function errorMessage(err: unknown): string {
	if (err instanceof Error) {
		return err.message;
	}
	return String(err);
}
