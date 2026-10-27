// Collects the licenses of everything that ships inside the app into
// src/features/about/license-data.json, which the About screen shows.
//
// JS packages: the ones Metro actually puts in the release bundle, read from its source map
// (react-native's own dev tooling never reaches the phone, so it is not listed).
// Native parts and assets: listed in NATIVE below.
//
// Run `bun run licenses` after adding, removing or updating dependencies.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'src/features/about/license-data.json');

const read = path => readFileSync(path, 'utf8').replace(/\r\n/g, '\n').trim();
const reactNativeLicense = () => read(join(root, 'node_modules/react-native/LICENSE'));

/** Standard license texts, from the system (Debian/Ubuntu ship them) or scripts/license-texts. */
function standard(name) {
	for (const dir of [join(root, 'scripts/license-texts'), '/usr/share/common-licenses']) {
		if (existsSync(join(dir, name))) {
			return read(join(dir, name));
		}
	}
	throw new Error(`No text for ${name}: add it as scripts/license-texts/${name}`);
}

// quoted from 7-Zip's readme
const UNRAR = `Notes about the unRAR license (from 7-Zip's readme):

Please check main restriction from unRar license:

   2. The unRAR sources may be used in any software to handle RAR
      archives without limitations free of charge, but cannot be used
      to re-create the RAR compression algorithm, which is proprietary.
      Distribution of modified unRAR sources in separate form or as a
      part of other software is permitted, provided that it is clearly
      stated in the documentation and source comments that the code may
      not be used to develop a RAR (WinRAR) compatible archiver.`;

// SQLite's own words in place of a license; the same in every release
const SQLITE_BLESSING = `The author disclaims copyright to this source code. In place of
a legal notice, here is a blessing:

   May you do good and not evil.
   May you find forgiveness for yourself and forgive others.
   May you share freely, never taking more than you give.`;

function sqliteVersion() {
	const header = read(join(root, 'node_modules/@op-engineering/op-sqlite/cpp/sqlite3.h'));
	return header.match(/#define SQLITE_VERSION\s+"([^"]+)"/)?.[1] ?? '';
}

const NATIVE = [
	{
		name: '7-Zip-JBinding-4Android',
		version: 'Release-16.02-2.03',
		license: 'LGPL-2.1-or-later with the unRAR restriction',
		url: 'https://github.com/omicronapps/7-Zip-JBinding-4Android',
		text: () => `RAR and 7z extraction. Contains 7-Zip by Igor Pavlov.\n\n${UNRAR}\n\n${standard('LGPL-2.1')}`,
	},
	{
		name: 'Google Sans Flex',
		version: '',
		license: 'OFL-1.1',
		url: 'https://fonts.google.com/specimen/Google+Sans+Flex',
		text: () => read(join(root, 'assets/fonts/OFL-GoogleSansFlex.txt')),
	},
	{
		name: 'SQLite',
		version: sqliteVersion,
		license: 'Public domain',
		url: 'https://sqlite.org/copyright.html',
		text: () => SQLITE_BLESSING,
	},
	{
		name: 'MMKV',
		version: '',
		license: 'BSD-3-Clause',
		url: 'https://github.com/Tencent/MMKV/blob/master/LICENSE.TXT',
		text: () =>
			'Settings storage, used through react-native-mmkv.\n\nCopyright (C) 2018 THL A29 Limited, a Tencent company. ' +
			'Licensed under the BSD 3-Clause License. The full text, with the notices for the code MMKV ' +
			'itself includes, is at https://github.com/Tencent/MMKV/blob/master/LICENSE.TXT',
	},
	{
		name: 'Hermes',
		version: '',
		license: 'MIT',
		url: 'https://github.com/facebook/hermes',
		text: reactNativeLicense,
	},
	{
		name: 'AndroidX Core SplashScreen, Palette',
		version: '',
		license: 'Apache-2.0',
		url: 'https://developer.android.com/jetpack/androidx',
		text: () => standard('Apache-2.0'),
	},
];

/** Package names Metro bundles for a release build. */
function bundledPackages() {
	const dir = mkdtempSync(join(tmpdir(), 'kaiga-licenses-'));
	try {
		const map = join(dir, 'index.map');
		const result = spawnSync(
			join(root, 'node_modules/.bin/react-native'),
			[
				'bundle',
				'--platform',
				'android',
				'--dev',
				'false',
				'--entry-file',
				'index.js',
				'--bundle-output',
				join(dir, 'index.bundle'),
				'--sourcemap-output',
				map,
				'--assets-dest',
				join(dir, 'assets'),
			],
			{ cwd: root, stdio: ['ignore', 'ignore', 'inherit'] },
		);
		if (result.status !== 0) {
			throw new Error('react-native bundle failed');
		}
		const sm = JSON.parse(readFileSync(map, 'utf8'));
		const sources = sm.sections ? sm.sections.flatMap(s => s.map.sources) : sm.sources;
		const names = new Set();
		for (const s of sources) {
			const i = s.lastIndexOf('node_modules/');
			if (i >= 0) {
				const parts = s.slice(i + 'node_modules/'.length).split('/');
				names.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
			}
		}
		return [...names];
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
}

function licenseText(dir, meta) {
	const file = readdirSync(dir).find(f => /^(licen[cs]e|copying)(\.(md|txt))?$/i.test(f));
	if (file) {
		return read(join(dir, file));
	}
	// react-native's helper packages and metro's runtime ship without a file; they share its license
	if (meta.name.startsWith('@react-native/') || meta.name.startsWith('metro')) {
		return reactNativeLicense();
	}
	return `${meta.name} is licensed under ${meta.license}. The package ships without a license file.`;
}

const js = bundledPackages().map(name => {
	const dir = join(root, 'node_modules', name);
	const meta = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const license = typeof meta.license === 'string' ? meta.license : (meta.license?.type ?? 'Unknown');
	const repo = typeof meta.repository === 'string' ? meta.repository : (meta.repository?.url ?? meta.homepage ?? '');
	return {
		name: meta.name,
		version: meta.version,
		license,
		url: repo.replace(/^git\+/, '').replace(/\.git$/, ''),
		text: licenseText(dir, { ...meta, license }),
	};
});

const native = NATIVE.map(n => ({
	...n,
	version: typeof n.version === 'function' ? n.version() : n.version,
	text: n.text(),
}));
// Kaiga itself first: its license, with the additional permission from README.md
const app = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const readme = read(join(root, 'README.md'));
const permission = readme.match(/^Additional permission under GNU GPL[^\n]*$/m)?.[0];
if (!permission) {
	throw new Error('README.md lost the GPL additional permission paragraph');
}
const kaiga = {
	name: 'Kaiga',
	version: app.version,
	license: app.license,
	url: app.repository,
	text: `${permission}\n\n${read(join(root, 'LICENSE'))}`,
};
const all = [kaiga, ...native, ...js.sort((a, b) => a.name.localeCompare(b.name))];
writeFileSync(out, `${JSON.stringify(all, null, '\t')}\n`);
console.log(`${all.length} components written to ${out}`);
