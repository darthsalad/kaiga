# Third-party notices

Kaiga is licensed under the GNU General Public License v3.0 or later (see `LICENSE`). It includes or links to the following third-party software.

## Bundled with the app

| Component | License | Notes |
| --- | --- | --- |
| [Google Sans Flex](https://fonts.google.com/specimen/Google+Sans+Flex) | SIL Open Font License 1.1 | Full text in `assets/fonts/OFL-GoogleSansFlex.txt` |
| [7-Zip-JBinding-4Android](https://github.com/omicronapps/7-Zip-JBinding-4Android) | GNU LGPL 2.1 or later, with the unRAR restriction | RAR and 7z extraction. Contains 7-Zip by Igor Pavlov. |
| [AndroidX Palette, Core SplashScreen](https://developer.android.com/jetpack/androidx) | Apache 2.0 | Cover colours and launch screen |
| [React Native](https://github.com/facebook/react-native), [React](https://github.com/facebook/react), Hermes | MIT | |
| [react-native-reanimated](https://github.com/software-mansion/react-native-reanimated), [react-native-worklets](https://github.com/software-mansion/react-native-reanimated), [react-native-gesture-handler](https://github.com/software-mansion/react-native-gesture-handler), [react-native-screens](https://github.com/software-mansion/react-native-screens), [react-native-svg](https://github.com/software-mansion/react-native-svg) | MIT | |
| [React Navigation](https://github.com/react-navigation/react-navigation) | MIT | |
| [FlashList](https://github.com/Shopify/flash-list) | MIT | |
| [op-sqlite](https://github.com/OP-Engineering/op-sqlite) | MIT | Includes SQLite, which is in the public domain |
| [react-native-mmkv](https://github.com/mrousavy/react-native-mmkv), [react-native-nitro-modules](https://github.com/mrousavy/nitro) | MIT | MMKV itself is BSD 3-Clause |
| [@react-native-documents/picker](https://github.com/react-native-documents/document-picker) | MIT | |
| [react-native-safe-area-context](https://github.com/AppAndFlow/react-native-safe-area-context) | MIT | |
| [Lucide](https://github.com/lucide-icons/lucide) | ISC | Icons |

## The unRAR restriction

7-Zip-JBinding includes 7-Zip's RAR decoder, which is based on the unRAR source code by Alexander Roshal. Its license allows the code to be used to extract RAR archives, but not to re-create the RAR compression algorithm, which is proprietary. Kaiga only extracts.

Because this restriction is not compatible with the GPL on its own, Kaiga's license carries an additional permission for it; see the License section of `README.md`.
