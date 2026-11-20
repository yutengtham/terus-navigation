import { useCallback, useState } from 'react';
import type { TravelMode } from '../models/route';
import type { AppLanguage } from '../i18n/arrowStrings';
import type { ComfortPreference } from '../services/comfortService';
import { DEFAULT_AVATAR, presetFor, type AvatarChoice } from '../config/avatars';
import type { PersonalityId } from '../config/data/voicePersonalities';

/** All user preferences, saved on this device. */
export type Settings = {
  voice: boolean;
  /** auto = night map from 7 pm to 7 am Malaysia time */
  appearance: 'auto' | 'day' | 'night';
  /** 3d = tilted view with 3D buildings; 2d = flat, top-down map (lighter, like a paper map) */
  mapView: '3d' | '2d';
  avoidTolls: boolean;
  avoidHighways: boolean;
  avoidFerries: boolean;
  units: 'metric' | 'imperial';
  /** Trees, landmarks and detailed facades. Off = smoother on older / mid-range phones. */
  detailed3d: boolean;
  keepScreenOn: boolean;
  /** Car, walk or cycle - remembers the last one picked on the route screen */
  travelMode: TravelMode;
  /** Walking / cycling: fastest route, or prefer shade (sunny) / shelter (rainy), like Undercover */
  comfort: ComfortPreference;
  /** en / ms / zh. Arrow Mode text + voice follow this; other screens are English for now. */
  language: AppLanguage;
  /** Arrow Mode simulates movement along the route (for presenting indoors). Also: ?demo=1 */
  arrowDemo: boolean;
  /** Lane arrows + junction view + lane voice cue before junctions */
  laneGuidance: boolean;
  /** "Next toll" card, 1 km reminder and vibration */
  tollReminder: boolean;
  /** Lane-level road (lanes, dividers, green guide path) on the 3D map while driving */
  laneView: boolean;
  /** Official MET Malaysia / JPS weather + flood alerts on the route (data.gov.my) */
  hazardAlerts: boolean;
  /** Spoken hazard alert ~5 km and 1 km before an affected stretch */
  hazardVoice: boolean;
  /** Fake flood + thunderstorm alerts for presenting. Also: ?demo=flood */
  floodDemo: boolean;
  /** What represents you on the map (driving; optionally every mode) */
  avatar: AvatarChoice;
  /** Fun voice personality (jokes only after the real instruction; Standard = none) */
  voicePersonality: PersonalityId;
  /** Report button, own warning pins on the map, Wanted posters */
  hazardReports: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  voice: true,
  appearance: 'auto',
  mapView: '3d',
  avoidTolls: false,
  avoidHighways: false,
  avoidFerries: false,
  units: 'metric', // Malaysia uses kilometres and km/h
  detailed3d: true,
  keepScreenOn: true,
  travelMode: 'driving',
  comfort: 'shade', // Malaysian sun: shade is the most common wish
  language: 'en',
  arrowDemo: false,
  laneGuidance: true,
  tollReminder: true,
  laneView: true,
  hazardAlerts: true,
  hazardVoice: true,
  floodDemo: false,
  avatar: DEFAULT_AVATAR,
  voicePersonality: 'standard',
  hazardReports: true,
};

// Storage keys keep the app's old name (NovaNav) so saved settings survive the rename to Terus.
const KEY = 'novanav.settings';

function load(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Settings>;
    // Carry over the two settings that earlier versions saved separately.
    const legacy: Partial<Settings> = {};
    if (localStorage.getItem('novanav.avoidTolls') === 'true') legacy.avoidTolls = true;
    if (localStorage.getItem('novanav.voice') === 'false') legacy.voice = false;
    // Opening the app with ?demo=1 in the address turns Arrow Mode demo on (handy on a presenter's phone).
    const demo = new URLSearchParams(location.search).get('demo');
    // ?demo=flood turns on fake flood / thunderstorm alerts (for presenting).
    // ?demo=fun: durian avatar (and the fun voice / sample report, see App).
    const durian = presetFor('durian');
    const fromUrl: Partial<Settings> =
      demo === '1'
        ? { arrowDemo: true }
        : demo === 'flood'
          ? { floodDemo: true, hazardAlerts: true }
          : demo === 'fun'
            ? { voicePersonality: 'makcik', avatar: { ...DEFAULT_AVATAR, body: 'durian', main: durian.main, accent: durian.accent, accessory: 'sunglasses', name: 'Raja Buah' } }
            : {};
    const merged = { ...DEFAULT_SETTINGS, ...legacy, ...saved, ...fromUrl };
    return { ...merged, avatar: { ...DEFAULT_AVATAR, ...merged.avatar } };
  } catch {
    return DEFAULT_SETTINGS; // storage unavailable (private mode) - use defaults
  }
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load);

  const update = useCallback((changes: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...changes };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return [settings, update] as const;
}

/** Is it night in Malaysia right now? KL sunset/sunrise stay near 7:15 pm / 7:05 am all year. */
export function isNightInMalaysia(date = new Date()): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Kuala_Lumpur' }).format(date),
  );
  return hour >= 19 || hour < 7;
}
