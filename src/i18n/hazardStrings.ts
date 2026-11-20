import type { HazardType, RouteHazard } from '../models/hazard';
import type { AppLanguage } from './arrowStrings';

export const HAZARD_ICON: Record<HazardType, string> = {
  flood: '🌊',
  heavy_rain: '🌧️',
  thunderstorm: '⛈️',
  wind: '💨',
  other: '⚠️',
};

/** Short English label for pills / cards (the rest of these screens are English for now). */
export const HAZARD_LABEL: Record<HazardType, string> = {
  flood: 'Flood alert',
  heavy_rain: 'Heavy rain',
  thunderstorm: 'Thunderstorm',
  wind: 'Strong wind',
  other: 'Weather warning',
};

const SPOKEN_TYPE: Record<AppLanguage, Record<HazardType, string>> = {
  en: { flood: 'Flood warning', heavy_rain: 'Heavy rain warning', thunderstorm: 'Thunderstorm warning', wind: 'Strong wind warning', other: 'Weather warning' },
  ms: { flood: 'Amaran banjir', heavy_rain: 'Amaran hujan lebat', thunderstorm: 'Amaran ribut petir', wind: 'Amaran angin kencang', other: 'Amaran cuaca' },
  zh: { flood: '水灾警报', heavy_rain: '暴雨警报', thunderstorm: '雷暴警报', wind: '强风警报', other: '天气警报' },
};

/** "Flood warning on your route in 5 kilometres. Please drive carefully." in the app language. */
export function hazardVoice(type: HazardType, km: number, lang: AppLanguage): string {
  const what = SPOKEN_TYPE[lang][type];
  if (lang === 'ms') return `${what} di laluan anda dalam ${km} kilometer. Sila berhati-hati.`;
  if (lang === 'zh') return `前方${km}公里路段有${what}，请小心驾驶。`;
  return `${what} on your route in ${km} ${km === 1 ? 'kilometre' : 'kilometres'}. Please drive carefully.`;
}

/** Title in the user's language when the source gives one, else English. */
export function hazardTitle(h: RouteHazard, lang: AppLanguage): string {
  return (lang === 'ms' ? h.title.ms : lang === 'zh' ? h.title.zh : undefined) ?? h.title.en;
}

export const HAZARD_DISCLAIMER = 'Official alerts may miss some roads. Never drive through flood water.';
