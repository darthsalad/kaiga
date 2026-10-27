import { Kaiga } from '../native/kaiga';
import { getSetting } from '../storage/settings';

/**
 * light: a short tick when the reader hits the first or last page.
 * long: a firmer one when a long press opens a menu.
 * Android also skips these when touch feedback is off in system settings.
 */
export function haptic(kind: 'light' | 'long') {
	if (getSetting('haptics')) {
		Kaiga.haptic(kind);
	}
}
