/**
 * One entry per schema version. Never edit a shipped entry; append a new one.
 * Timestamps are milliseconds since the epoch.
 */
export const migrations: string[][] = [
	[
		`CREATE TABLE comics (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			title TEXT NOT NULL,
			format TEXT,
			source_uri TEXT NOT NULL UNIQUE,
			source_name TEXT NOT NULL,
			source_label TEXT,
			source_size INTEGER,
			source_modified INTEGER,
			page_count INTEGER NOT NULL DEFAULT 0,
			cover_path TEXT,
			cover_color TEXT,
			cover_version INTEGER NOT NULL DEFAULT 0,
			local_state TEXT NOT NULL DEFAULT 'queued'
				CHECK (local_state IN ('queued', 'downloading', 'ready', 'evicted', 'error', 'unavailable')),
			local_size INTEGER,
			error TEXT,
			keep_offline INTEGER NOT NULL DEFAULT 0,
			bookmarked INTEGER NOT NULL DEFAULT 0,
			progress_page INTEGER,
			last_opened_at INTEGER,
			last_accessed_at INTEGER,
			added_at INTEGER NOT NULL
		)`,
		`CREATE INDEX idx_comics_last_opened ON comics (last_opened_at DESC) WHERE last_opened_at IS NOT NULL`,
		`CREATE INDEX idx_comics_eviction ON comics (local_state, last_accessed_at)`,
		`CREATE TABLE pages (
			comic_id INTEGER NOT NULL REFERENCES comics (id) ON DELETE CASCADE,
			idx INTEGER NOT NULL,
			entry_name TEXT NOT NULL,
			width INTEGER,
			height INTEGER,
			PRIMARY KEY (comic_id, idx)
		)`,
		`CREATE TABLE page_rotations (
			comic_id INTEGER NOT NULL REFERENCES comics (id) ON DELETE CASCADE,
			entry_name TEXT NOT NULL,
			rotation INTEGER NOT NULL CHECK (rotation IN (0, 90, 180, 270)),
			PRIMARY KEY (comic_id, entry_name)
		)`,
		`CREATE TABLE tags (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL UNIQUE COLLATE NOCASE
		)`,
		`CREATE TABLE comic_tags (
			comic_id INTEGER NOT NULL REFERENCES comics (id) ON DELETE CASCADE,
			tag_id INTEGER NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
			PRIMARY KEY (comic_id, tag_id)
		)`,
		`CREATE INDEX idx_comic_tags_tag ON comic_tags (tag_id, comic_id)`,
	],
	[
		// 'copy': the archive is downloaded into app storage and may be cleaned up
		// 'direct': the file already lives on the phone and is read in place
		`ALTER TABLE comics ADD COLUMN storage TEXT NOT NULL DEFAULT 'copy' CHECK (storage IN ('copy', 'direct'))`,
	],
	[
		// folders the user asked Kaiga to watch (picked with the folder picker)
		`CREATE TABLE library_roots (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			tree_uri TEXT NOT NULL UNIQUE,
			name TEXT NOT NULL,
			label TEXT,
			watching INTEGER NOT NULL DEFAULT 1,
			last_scan_at INTEGER,
			error TEXT,
			added_at INTEGER NOT NULL
		)`,
		// groups in the library: a file's parent directory (key set) or one made by hand (key NULL)
		`CREATE TABLE folders (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			key TEXT UNIQUE,
			name TEXT NOT NULL,
			location TEXT,
			manual INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		)`,
		`ALTER TABLE comics ADD COLUMN folder_id INTEGER REFERENCES folders (id) ON DELETE SET NULL`,
		// set when the user moved the comic by hand, so scans never regroup it
		`ALTER TABLE comics ADD COLUMN folder_locked INTEGER NOT NULL DEFAULT 0`,
		`ALTER TABLE comics ADD COLUMN root_id INTEGER REFERENCES library_roots (id) ON DELETE SET NULL`,
		// path inside a watched folder, used to match files across scans
		`ALTER TABLE comics ADD COLUMN root_path TEXT`,
		`CREATE INDEX idx_comics_folder ON comics (folder_id)`,
		`CREATE INDEX idx_comics_root ON comics (root_id)`,
	],
	[
		// details from the archive's ComicInfo.xml, falling back to what the file name says
		`ALTER TABLE comics ADD COLUMN series TEXT`,
		`ALTER TABLE comics ADD COLUMN issue_number TEXT`,
		`ALTER TABLE comics ADD COLUMN issue_count INTEGER`,
		`ALTER TABLE comics ADD COLUMN volume INTEGER`,
		`ALTER TABLE comics ADD COLUMN year INTEGER`,
		`ALTER TABLE comics ADD COLUMN summary TEXT`,
		`ALTER TABLE comics ADD COLUMN writer TEXT`,
		`ALTER TABLE comics ADD COLUMN artist TEXT`,
		`ALTER TABLE comics ADD COLUMN publisher TEXT`,
		`ALTER TABLE comics ADD COLUMN genre TEXT`,
		// overrides the reading direction setting for this comic (manga marked right-to-left)
		`ALTER TABLE comics ADD COLUMN reading_direction TEXT CHECK (reading_direction IN ('ltr', 'rtl', 'vertical'))`,
		// bumped when metadata reading improves, so existing comics are read again
		`ALTER TABLE comics ADD COLUMN meta_version INTEGER NOT NULL DEFAULT 0`,
	],
];
