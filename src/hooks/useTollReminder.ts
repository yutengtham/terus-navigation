import { useEffect, useRef } from 'react';
import { SPEECH_LANG, type AppLanguage } from '../i18n/arrowStrings';
import { TOLL_STRINGS } from '../i18n/navStrings';
import type { UpcomingToll } from '../services/tollAhead';
import { speak } from '../services/voiceService';

/** Highlight, speak and vibrate when the next toll plaza is this close. */
export const TOLL_NEAR_M = 1000;

/**
 * One reminder per toll plaza when it comes within 1 km: a short spoken reminder (if voice is
 * on) and one vibration (Android; iPhone browsers don't allow vibration).
 * Returns true while the plaza is within 1 km, so the card can turn amber.
 */
export function useTollReminder(next: UpcomingToll | null, voiceEnabled: boolean, lang: AppLanguage, routeId: unknown): boolean {
  const reminded = useRef(new Set<string>());
  useEffect(() => {
    reminded.current = new Set();
  }, [routeId]);

  const near = !!next && next.distance <= TOLL_NEAR_M;
  const key = next ? `${next.name}@${Math.round(next.along)}` : '';

  useEffect(() => {
    if (!near || !next || reminded.current.has(key)) return;
    reminded.current.add(key);
    navigator.vibrate?.(250);
    // Say the real distance if we're already closer than 1 km (e.g. right after a reroute).
    if (voiceEnabled && next.distance > 100) speak(TOLL_STRINGS[lang].reminder(next.distance), { lang: SPEECH_LANG[lang] });
  }, [near, key, next, voiceEnabled, lang]);

  return near;
}
