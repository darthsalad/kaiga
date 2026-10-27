<p align="center">
  <img src="docs/branding/icon.svg" width="96" height="96" alt="Kaiga icon">
</p>

# Kaiga

An offline-first comic reader for Android, built for CBZ and CBR.

Add comics from your phone, Google Drive or any other app that shows up in the Android file picker. Comics on the phone are read where they are. Cloud files are copied to the phone so they read offline, and removed after a week unopened; the cover, progress and rotations stay, and opening the comic again fetches it back.

Kaiga has no accounts, no analytics and no network access: release builds do not request the internet permission.

## Features

- CBZ, CBR (RAR4 and RAR5, including solid archives) and CB7. The format is read from the file itself, so a `.cbr` that is really a ZIP still opens.
- Watched library folders. Pick a folder once and Kaiga picks up new comics, follows renames and marks files that went missing. Pull down on the library to rescan.
- Folders group comics by the directory they live in, and you can move comics between folders. Finishing a comic offers the next one in its folder.
- Wide two-page spreads open zoomed on the first half, then the second, then turn the page. Right-to-left reading starts on the right half.
- Rotate any page and Kaiga remembers it for that page.
- Pinch to zoom, double-tap, swipe or tap the edges to turn pages, and a vertical scroll mode for webtoons.
- Bookmark comics and tag them, then filter the library by bookmark or tag. Long-press a comic for quick actions.
- History with swipe-to-delete, which resets that comic's progress.
- Material You colours on Android 12+, with each comic tinted by its cover. Themed icon on Android 13+.

## Install

Kaiga is not on the Play Store. Download an APK from the [Releases](../../releases) page, open it on your phone and allow your browser or file manager to install unknown apps when Android asks. Android 7.0 or newer is required.

| APK | For |
| --- | --- |
| `kaiga-vX.Y.Z-arm64-v8a.apk` | almost every phone from the last ten years |
| `kaiga-vX.Y.Z-armeabi-v7a.apk` | older 32-bit phones |
| `kaiga-vX.Y.Z-universal.apk` | either, if you're unsure (bigger download) |

`SHA256SUMS.txt` on the same page lets you check the download: `sha256sum -c SHA256SUMS.txt --ignore-missing`.

## Building

Requirements: Node 22.11+, [Bun](https://bun.sh), JDK 17 and the Android SDK.

```sh
bun install
bun start            # Metro, for development builds
bun run android      # debug build on a connected device or emulator
```

A release APK that runs without Metro (one ABI keeps the build quick):

```sh
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
adb install -r app/build/outputs/apk/release/app-arm64-v8a-release.apk
```

Release builds are shrunk with R8 and split per ABI, plus a universal APK. They are signed with your release key when these Gradle properties are set (for example in `~/.gradle/gradle.properties`), and with the debug key otherwise, which is fine for testing but not for sharing:

```properties
KAIGA_RELEASE_STORE_FILE=/path/to/kaiga-release.jks
KAIGA_RELEASE_STORE_PASSWORD=...
KAIGA_RELEASE_KEY_ALIAS=kaiga
KAIGA_RELEASE_KEY_PASSWORD=...
```

Checks that CI runs on every pull request:

```sh
bun run tsc
bunx eslint 'src/**/*.{ts,tsx}' App.tsx
bun run test
```

After changing dependencies, regenerate the licenses shown in the app with `bun run licenses`.

## Releasing

1. Set the new version in `package.json` (Android's `versionName` is read from it) and raise `versionCode` in `android/app/build.gradle`.
2. Move the changes under a new heading in `CHANGELOG.md`.
3. Commit, then tag and push: `git tag v0.1.0 && git push origin v0.1.0`.
4. The Release workflow builds signed APKs, checksums them and opens a draft release with the changelog section as notes. Check it and publish.

The workflow needs the signing key as repository secrets; see the comment at the top of `.github/workflows/release.yml`.

## How storage works

| What | Where | Removed |
| --- | --- | --- |
| Comics on the phone | where they are; Kaiga only keeps access to them | never by Kaiga |
| Comics from cloud apps | app files | after the configured days without opening (default 7), unless kept offline |
| Covers | app files | only when the comic is removed |
| Extracted pages | app cache | kept for the 3 most recently read comics; Android may also clear them |

Progress, rotations, bookmarks, tags and folders live in a local SQLite database and survive cleanup.

## Project layout

```
android/app/src/main/java/com/darthsalad/kaiga/nativemodule   archive reading, file copying, folder scans, thumbnails
src/native         TurboModule spec and wrapper
src/db             SQLite schema, migrations and queries
src/services       import queue, folder scans, re-download and cleanup
src/features       library, folder, detail, reader, history and settings screens
src/components     shared UI
docs/branding      icon source
scripts            licenses.mjs: builds the in-app license list
```

What is planned or still missing is in [TODO.md](TODO.md); what changed is in [CHANGELOG.md](CHANGELOG.md).

## License

Kaiga is free software: you can redistribute it and/or modify it under the terms of the GNU General Public License as published by the Free Software Foundation, either version 3 of the License, or (at your option) any later version. See [LICENSE](LICENSE).

Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with 7-Zip-JBinding (or a modified version of that library), containing parts covered by the terms of the unRAR license, the licensors of this program grant you additional permission to convey the resulting work.

Third-party components and their licenses are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
