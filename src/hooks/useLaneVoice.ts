import { useEffect, useRef } from 'react';
import { SPEECH_LANG, type AppLanguage } from '../i18n/arrowStrings';
import { laneVoiceCue } from '../i18n/navStrings';
import type { Maneuver } from '../models/route';
import { describeRecommended, type Lane } from '../services/laneGuidance';
import { speak } from '../services/voiceService';

type Upcoming = {
  /** Step index (one cue per junction) */
  key: number;
  lanes: Lane[] | null;
  maneuver: Maneuver | null;
  distance: number;
  towards: string | null;
  /** The lane row is showing (inside the 1.5 km / 500 m window) */
  visible: boolean;
};

/** Below this the junction is too close for a lane cue to help. */
const TOO_CLOSE_M = 80;

/**
 * Speaks one lane cue per junction when the lane row appears, e.g.
 * "In 1 kilometre, keep right, use the two right lanes, towards Kerinchi Link."
 * Mapbox's own (English) turn instructions keep playing as before.
 */
export function useLaneVoice(upcoming: Upcoming | null, enabled: boolean, lang: AppLanguage, routeId: unknown): void {
  const spoken = useRef(new Set<number>());
  useEffect(() => {
    spoken.current = new Set(); // new route or reroute
  }, [routeId]);

  useEffect(() => {
    if (!enabled || !upcoming?.visible || !upcoming.lanes) return;
    if (spoken.current.has(upcoming.key) || upcoming.distance < TOO_CLOSE_M) return;
    spoken.current.add(upcoming.key);
    const text = laneVoiceCue({
      meters: upcoming.distance,
      maneuver: upcoming.maneuver,
      lanes: describeRecommended(upcoming.lanes),
      totalLanes: upcoming.lanes.length,
      towards: upcoming.towards,
      lang,
    });
    speak(text, { lang: SPEECH_LANG[lang] });
  }, [upcoming, enabled, lang]);
}
