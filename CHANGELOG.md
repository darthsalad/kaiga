# Changelog

All notable changes to Kaiga are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and versions follow [Semantic Versioning](https://semver.org/).

## [0.1.0] - Unreleased

First release of the rewrite.

### Added

- CBZ, CBR (RAR4 and RAR5, including solid archives) and CB7. The format is read from the file itself, so a `.cbr` that is really a ZIP still opens.
- Add comics from the Android file picker, including Google Drive and other cloud apps. Files on the phone are read in place; cloud files are copied to the phone and removed after a configurable number of days unopened, then fetched again when opened.
- Watched library folders: pick a folder once and Kaiga adds new comics, follows renames and marks missing files. Pull down on the library to rescan.
- Folders group comics by the directory they live in. Comics can be moved into other folders or new ones, and reading the last page offers the next comic in the folder.
- Reader with pinch zoom, double-tap, swipe and edge taps, left-to-right, right-to-left and vertical modes.
- Wide two-page spreads open on the first half, then the second, then turn the page. Right-to-left starts on the right half.
- Rotate any page; the rotation is remembered for that page.
- Bookmarks and free-form tags, with filters in the library. Long-press a comic to bookmark it, reset its progress or remove it.
- History with swipe to delete, which resets progress, and undo.
- Keep the screen on while reading, and choose how many recent comics keep their pages cached.
- Haptic feedback at the first and last page and on long press.
- The library grid adds columns on tablets and in landscape.
- Reads `ComicInfo.xml` (series, issue, year, summary, credits, publisher, genre) and falls back to the file name. Titles become "Series #N", folders sort by issue number, and manga marked right-to-left opens that way.
- A page preview above the scrubber while dragging.
- Material You colours on Android 12+, light and dark themes, and Google Sans Flex.
- App icon (with a themed version for Android 13+) and launch screen.
- About screen with the version, source link, Kaiga's license and the licenses of everything bundled.
- A recovery screen instead of a crash when something goes wrong.
- Per-ABI release APKs (plus a universal one), shrunk with R8.
