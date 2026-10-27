import { useEffect, useRef, useState } from 'react';

export type Table = 'comics' | 'pages' | 'tags' | 'folders' | 'roots';

const listeners = new Map<Table, Set<() => void>>();

/** Call after a write so screens showing those tables reload. */
export function notify(...tables: Table[]) {
	const fired = new Set<() => void>();
	for (const table of tables) {
		listeners.get(table)?.forEach(l => {
			if (!fired.has(l)) {
				fired.add(l);
				l();
			}
		});
	}
}

function subscribe(tables: Table[], listener: () => void) {
	for (const table of tables) {
		if (!listeners.has(table)) {
			listeners.set(table, new Set());
		}
		listeners.get(table)!.add(listener);
	}
	return () => tables.forEach(t => listeners.get(t)?.delete(listener));
}

/**
 * Runs [load] now, whenever [deps] change, and whenever one of [tables] is written to.
 * Keeps the previous data while reloading so lists don't flash empty.
 */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[], tables: Table[]) {
	const [data, setData] = useState<T | undefined>(undefined);
	const [error, setError] = useState<Error | null>(null);
	const loadRef = useRef(load);
	loadRef.current = load;

	useEffect(() => {
		let alive = true;
		let pending = false;
		const reload = () => {
			if (pending) {
				return;
			}
			pending = true;
			// coalesce bursts of writes (an import touches several tables) into one reload
			Promise.resolve().then(() => {
				pending = false;
				loadRef
					.current()
					.then(result => alive && setData(result))
					.catch(err => alive && setError(err instanceof Error ? err : new Error(String(err))));
			});
		};
		reload();
		const unsubscribe = subscribe(tables, reload);
		return () => {
			alive = false;
			unsubscribe();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [...deps, tables.join()]);

	return { data, error, loading: data === undefined && error === null };
}
