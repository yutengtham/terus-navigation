import { useEffect, useRef } from 'react';
import { SPEECH_LANG, type AppLanguage } from '../i18n/arrowStrings';
import { hazardVoice } from '../i18n/hazardStrings';
import type { RouteHazard } from '../models/hazard';
import { speak } from '../services/voiceService';

/**
 * Spoken alert (plus one vibration) about 5 km and again 1 km before each affected stretch.
 * Each alert fires once per hazard; already being inside a stretch says nothing new.
 */
export function useHazardVoice(hazards: RouteHazard[], traveledM: number | null, enabled: boolean, lang: AppLanguage, routeId: unknown): void {
  const said = useRef(new Set<string>());
  useEffect(() => {
    said.current = new Set();
  }, [routeId]);

  useEffect(() => {
    if (traveledM === null) return;
    for (const h of hazards) {
      const aheadKm = h.segment.startKm - traveledM / 1000;
      if (aheadKm <= 0) continue;
      const stage = aheadKm <= 1 ? '1' : aheadKm <= 5 ? '5' : null;
      if (!stage) continue;
      const k = `${h.id}@${stage}`;
      if (said.current.has(k)) continue;
      said.current.add(k);
      if (stage === '1') said.current.add(`${h.id}@5`); // started closer than 1 km: one alert only
      navigator.vibrate?.(300);
      if (enabled) speak(hazardVoice(h.type, stage === '1' ? 1 : Math.max(2, Math.round(aheadKm)), lang), { lang: SPEECH_LANG[lang] });
      break; // one alert at a time
    }
  }, [hazards, traveledM, enabled, lang]);
}
