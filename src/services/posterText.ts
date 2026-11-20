// Chooses the words on a poster (pure - no canvas).
import { POSTER_PHRASES, type PosterLang } from '../config/data/posterPhrases';
import type { AppLanguage } from '../i18n/arrowStrings';
import { REPORT_STRINGS, REPORT_TYPE_LABEL } from '../i18n/reportStrings';
import type { RoadReport } from '../models/report';
import { posterDate } from './posterLayout';

export type PosterText = {
  header: string;
  sub: string;
  roadLine: string;
  lastSeen: string;
  crime: string;
  reward: string;
  dangerLabel: string;
  danger: number;
};

/** Which phrase pools follow the app language (English also gets the Manglish lines). */
export function poolsFor(lang: AppLanguage): PosterLang[] {
  return lang === 'en' ? ['en', 'manglish'] : [lang];
}

export function posterText(r: RoadReport, lang: AppLanguage): PosterText {
  const t = REPORT_STRINGS[lang];
  const phrases = POSTER_PHRASES[r.type];
  const road = r.roadName.trim() || t.thisRoad;
  const crimes = poolsFor(lang).flatMap((l) => phrases.crime[l]);
  const rewards = poolsFor(lang).flatMap((l) => phrases.reward[l]);
  const seed = Math.abs(Math.floor(r.lineSeed));
  const crime = crimes[seed % crimes.length].replaceAll('{road}', road);
  const reward = rewards[(seed * 7 + 3) % rewards.length].replaceAll('{road}', road);
  const typeLabel = REPORT_TYPE_LABEL[r.type][lang];
  return {
    header: 'DICARI',
    sub: t.wanted,
    // e.g. "LUBANG JALAN JALAN KLANG LAMA" (Malay), "POTHOLE · JALAN KLANG LAMA"
    roadLine: (lang === 'ms' ? `${typeLabel} ${road}` : `${typeLabel} · ${road}`).toUpperCase(),
    lastSeen: `${t.lastSeen}: ${posterDate(r.createdAt, lang)}`,
    crime,
    reward,
    dangerLabel: t.dangerLevel,
    danger: Math.max(1, Math.min(5, Math.round(r.danger))),
  };
}

/** Plain text for MyJalan / clipboard (factual - no jokes). */
export function reportPlainText(r: RoadReport, lang: AppLanguage): string {
  const type = REPORT_TYPE_LABEL[r.type][lang];
  const [lng, lat] = r.location;
  const when = posterDate(r.createdAt, lang);
  const lines = [
    `${type}${r.roadName ? ` – ${r.roadName}` : ''}`,
    `${lang === 'ms' ? 'Masa' : lang === 'zh' ? '时间' : 'Time'}: ${when}`,
    `${lang === 'ms' ? 'Lokasi' : lang === 'zh' ? '位置' : 'Location'}: ${lat.toFixed(6)}, ${lng.toFixed(6)} (https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)})`,
  ];
  if (r.note.trim()) lines.push(`${lang === 'ms' ? 'Nota' : lang === 'zh' ? '备注' : 'Note'}: ${r.note.trim()}`);
  return lines.join('\n');
}
