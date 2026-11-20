import { POSTER_PHRASES, type PosterLang } from '../config/data/posterPhrases';
import type { AppLanguage } from '../i18n/arrowStrings';
import type { ReportType, RoadReport } from '../models/report';
import { myJalanUrl } from '../services/myJalan';
import { DANGER_Y, fitText, textStack, type Measure } from '../services/posterLayout';
import { posterText, reportPlainText } from '../services/posterText';
import type { CheckResult } from './navChecks';

/** Approximate text width for checks (no canvas in tests): bold caps ~0.62 em, CJK 1 em. */
const approx: Measure = (s, size) => [...s].reduce((w, ch) => w + (/[　-鿿＀-￯]/.test(ch) ? 1 : 0.62) * size, 0);

const TYPES: ReportType[] = ['pothole', 'roadblock', 'flooded', 'accident', 'traffic_light', 'other'];

export function runPosterChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = '') => results.push({ name: `Poster: ${name}`, pass, detail });

  const long = 'LUBANG JALAN JALAN TUANKU ABDUL RAHMAN DAN PERSIARAN SULTAN SALAHUDDIN ABDUL AZIZ SHAH';
  const f = fitText(long, approx, 900, 2, 92, 46);
  check('Long road name fits in 2 lines, each within the poster width', f.lines.length <= 2 && f.lines.every((l) => approx(l, f.size) <= 900), `${f.size}px: ${f.lines.join(' / ')}`);
  const short = fitText('LUBANG JALAN JALAN KLANG LAMA', approx, 900, 2, 92, 46);
  check('Short road name keeps a big font', short.size >= 80, `${short.size}px, ${short.lines.length} line(s)`);
  const huge = fitText('JALAN '.repeat(40), approx, 900, 2, 92, 46);
  check('Absurdly long name is cut with … instead of overflowing', huge.lines.length === 2 && huge.lines[1].endsWith('…') && huge.lines.every((l) => approx(l, 46) <= 900));
  const oneWord = fitText('SUPERCALIFRAGILISTICEXPIALIDOCIOUSROADNAMEWITHOUTSPACES', approx, 900, 2, 92, 46);
  check('A single giant word is broken, not overflowing', oneWord.lines.every((l) => approx(l, oneWord.size) <= 900));
  const zh = fitText('路面坑洞 · 吉隆坡旧巴生路与蕉赖路交界处的一条很长的道路名称', approx, 900, 2, 92, 46);
  check('Chinese text (no spaces) wraps by character', zh.lines.length <= 2 && zh.lines.every((l) => approx(l, zh.size) <= 900), zh.lines.join(' / '));

  // Worst case: every block at 2 lines and its biggest size - still above the danger meter.
  const two = (size: number) => ({ size, lines: ['a', 'b'] });
  const worst = textStack(two(fitText(long, approx, 900, 2, 92, 46).size), two(44), two(48));
  check('Text never runs into the danger meter (worst case)', worst.bottom < DANGER_Y - 40, `text ends at ${Math.round(worst.bottom)}, meter at ${DANGER_Y}`);

  // Phrase banks and text choice
  const gaps: string[] = [];
  for (const t of TYPES) for (const l of ['ms', 'en', 'manglish', 'zh'] as PosterLang[]) {
    if (POSTER_PHRASES[t].crime[l].length < 4) gaps.push(`${t}.crime.${l}`);
    if (POSTER_PHRASES[t].reward[l].length < 3) gaps.push(`${t}.reward.${l}`);
  }
  check('Every hazard type has 4+ funny lines and 3+ rewards in BM / EN / Manglish / 中文', gaps.length === 0, gaps.join(', '));

  const base: RoadReport = { id: 'x1', type: 'flooded', createdAt: Date.parse('2026-11-20T14:53:00+08:00'), location: [101.6738, 3.0995], roadName: 'Jalan Klang Lama', note: 'deep', photo: null, danger: 5, lineSeed: 0 };
  let placeholders = true;
  for (const t of TYPES) for (const lang of ['en', 'ms', 'zh'] as AppLanguage[]) for (let seed = 0; seed < 8; seed++) {
    const p = posterText({ ...base, type: t, lineSeed: seed }, lang);
    if (!p.crime || !p.reward || p.crime.includes('{road}') || p.reward.includes('{road}')) placeholders = false;
  }
  check('Every line has its {road} filled in, in every language', placeholders);
  check('Malay road line reads like "LUBANG JALAN JALAN KLANG LAMA"', posterText({ ...base, type: 'pothole' }, 'ms').roadLine === 'LUBANG JALAN JALAN KLANG LAMA');
  check('"Last seen" uses Malaysia time (20 Nov 2026, 2:53pm)', posterText(base, 'en').lastSeen === 'Last seen: 20 Nov 2026, 2:53pm', posterText(base, 'en').lastSeen);
  const a = posterText(base, 'en').crime;
  const b = posterText({ ...base, lineSeed: 1 }, 'en').crime;
  check('"New funny line" changes the line', a !== b);
  const enPool = new Set(Array.from({ length: 20 }, (_, i) => posterText({ ...base, lineSeed: i }, 'en').crime));
  check('English posters also rotate in Manglish lines', [...enPool].some((l) => POSTER_PHRASES.flooded.crime.manglish.map((m) => m.replaceAll('{road}', 'Jalan Klang Lama')).includes(l)));
  const plain = reportPlainText(base, 'ms');
  check('MyJalan text is factual (type, road, time, coordinates, note - no joke)', plain.includes('Jalan banjir – Jalan Klang Lama') && plain.includes('3.099500, 101.673800') && plain.includes('Nota: deep') && !plain.includes(posterText(base, 'ms').crime));
  check(
    'MyJalan opens the official app listing on phones, the gov info page on computers',
    myJalanUrl('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)').includes('apps.apple.com') && myJalanUrl('Mozilla/5.0 (Linux; Android 15)').includes('play.google.com') && myJalanUrl('Mozilla/5.0 (Windows NT 10.0)').includes('malaysia.gov.my'),
  );
  return results;
}
