# TODO

## Before the first GitHub release

- [ ] Create the release keystore and back it up; add it to `~/.gradle/gradle.properties` and the repository secrets (see README › Building and `.github/workflows/release.yml`).
- [ ] Push the repository to GitHub (`https://github.com/darthsalad/kaiga`).
- [ ] README screenshots.
- [ ] Tag `v0.1.0`.

## Needs testing on a device

- [ ] Folders: grouping, watched folders, pull to refresh, Move to folder.
- [ ] Long-press actions in the library.
- [ ] Reading phone files in place under scoped storage (the `/proc/self/fd` permission error fix).
- [ ] App icon on the home screen, the themed icon, and the launch screen (wordmark on Android 12+).
- [ ] Release build without the internet permission.
- [ ] Picker only offering comic archives (local and Drive), and a bad file showing its error without being added.
- [ ] Keep screen on, and the page cache setting.
- [ ] Haptics: a light tick at the first and last page, a firmer one on long press.
- [ ] Bottom sheets open at their final height (no jump), and lift above the keyboard when typing a folder name or tag.
- [ ] Library grid on a tablet or in landscape.
- [ ] Metadata: titles like "Green Lantern Corps - Recharge #1", the Rebirth summary, publisher and genre on its detail screen, folders sorted by issue. Comics already in the library are re-read once at launch.
- [ ] Scrubber preview: the page appears above the thumb (ZIP pages unpack on a pause; RAR and 7z show cached pages or just the number).
- [ ] RAR4 archives, password-protected and corrupt archives, a 1 GB+ archive, low storage.
- [ ] Light theme, the reader's split-page mode, Android 7, TalkBack.
- [ ] About screen, a few license pages, and the Source code link.

## Planned

- [ ] Cover-to-reader transition, predictive back.
- [ ] Undo for removing a comic from the library.

## To test later

- [ ] Release build with R8: open a RAR and a 7z (R8 can break 7-Zip-JBinding at runtime, not at build time). CBZ is fine.
- [ ] Whether Drive's picker provider streams a file or downloads all of it before handing it over. If it streams, the reader could start before the copy finishes.

## Not planned for now

- Downloads that survive the app being closed. An interrupted import restarts at the next launch, which is enough for comic-sized files. Revisit if large Drive imports keep getting cut off.
- ZIP files that hold several comics. Unzip them first; Kaiga says so and does not add the file.
- iOS.

## Done since the plan

- Keep screen on while reading (Settings › Reading).
- How many comics keep their extracted pages is configurable (Settings › Advanced, default 3).
- The picker only offers comic archives; a picked file that fails to open shows why and is not added.
- Stopping a watched folder releases Kaiga's access to it once none of its comics are left.
- Haptic feedback (Settings › Appearance).
- Bottom sheets no longer use a Modal, which made them jump on their first frame.
- `ComicInfo.xml` metadata with the file name as fallback: series, issue, year, summary, credits, publisher, genre; manga marked right-to-left opens right-to-left; folders sort by issue number.
- Page preview above the scrubber while dragging.
- About screen with all bundled licenses, crash recovery screen, per-ABI APKs with R8, release signing from Gradle properties, release workflow, issue templates.
- Tablets and landscape: the reader keeps one page in both orientations; the library grid fits more columns on wide screens.
