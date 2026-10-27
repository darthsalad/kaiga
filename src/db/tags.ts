import { notify } from './changes';
import { all, run } from './database';

export type Tag = { id: number; name: string };

export function normalizeTag(name: string) {
	return name.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase();
}

/** Tags in use, most used first. */
export async function allTags(): Promise<Tag[]> {
	return all<Tag>(
		`SELECT t.id, t.name FROM tags t
		 JOIN comic_tags ct ON ct.tag_id = t.id
		 GROUP BY t.id ORDER BY COUNT(*) DESC, t.name`,
	);
}

export async function tagsFor(comicId: number): Promise<Tag[]> {
	return all<Tag>(
		`SELECT t.id, t.name FROM tags t JOIN comic_tags ct ON ct.tag_id = t.id
		 WHERE ct.comic_id = ? ORDER BY t.name`,
		[comicId],
	);
}

export async function addTag(comicId: number, rawName: string) {
	const name = normalizeTag(rawName);
	if (!name) {
		return;
	}
	await run('INSERT INTO tags (name) VALUES (?) ON CONFLICT (name) DO NOTHING', [name]);
	await run(
		`INSERT INTO comic_tags (comic_id, tag_id)
		 SELECT ?, id FROM tags WHERE name = ? ON CONFLICT DO NOTHING`,
		[comicId, name],
	);
	notify('tags', 'comics');
}

export async function removeTag(comicId: number, tagId: number) {
	await run('DELETE FROM comic_tags WHERE comic_id = ? AND tag_id = ?', [comicId, tagId]);
	// tags only exist while something uses them
	await run('DELETE FROM tags WHERE id = ? AND id NOT IN (SELECT tag_id FROM comic_tags)', [tagId]);
	notify('tags', 'comics');
}
