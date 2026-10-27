import data from './license-data.json';

export type Component = {
	name: string;
	version: string;
	license: string;
	url: string;
	text: string;
};

/** Kaiga first, then native parts, then bundled JS packages. Regenerate with `bun run licenses`. */
export const components: Component[] = data;
