import type { Maneuver } from '../models/route';
import type { LanePosition } from '../services/laneGuidance';
import type { AppLanguage } from './arrowStrings';

/**
 * Text for lane guidance and the toll reminder on the Navigation screen, in the three
 * languages from Settings. (Mapbox's own turn-by-turn voice stays English.)
 */

const NUM: Record<AppLanguage, string[]> = {
  en: ['', 'one', 'two', 'three', 'four', 'five', 'six'],
  ms: ['', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam'],
  zh: ['', '一', '两', '三', '四', '五', '六'],
};

/** "In 1 kilometre" / "Dalam 500 meter" / "1公里后" (rounded like a person would say it). */
export function spokenDistance(meters: number, lang: AppLanguage): string {
  const km = meters >= 950;
  // Under 3 km: nearest half kilometre ("1.5 kilometres"); otherwise whole km / nearest 100 m.
  const value = km
    ? meters < 3000
      ? Math.max(1, Math.round(meters / 500) / 2)
      : Math.round(meters / 1000)
    : Math.max(50, Math.round(meters / 100) * 100);
  if (lang === 'ms') return `Dalam ${value} ${km ? 'kilometer' : 'meter'}`;
  if (lang === 'zh') return `${value}${km ? '公里' : '米'}后`;
  return `In ${value} ${km ? (value === 1 ? 'kilometre' : 'kilometres') : 'metres'}`;
}

type Action = 'keepLeft' | 'keepRight' | 'turnLeft' | 'turnRight' | 'straight' | 'uturn' | 'exitLeft' | 'exitRight';

function actionFor(m: Maneuver | null): Action {
  const mod = m?.modifier ?? '';
  const left = mod.includes('left');
  if (mod === 'uturn') return 'uturn';
  if (m?.type === 'off ramp') return left ? 'exitLeft' : 'exitRight';
  if (m?.type === 'fork' || m?.type === 'merge' || mod.startsWith('slight')) return left ? 'keepLeft' : mod.includes('right') ? 'keepRight' : 'straight';
  if (left) return 'turnLeft';
  if (mod.includes('right')) return 'turnRight';
  return 'straight';
}

const ACTIONS: Record<AppLanguage, Record<Action, string>> = {
  en: { keepLeft: 'keep left', keepRight: 'keep right', turnLeft: 'turn left', turnRight: 'turn right', straight: 'continue straight', uturn: 'make a U-turn', exitLeft: 'take the exit on the left', exitRight: 'take the exit on the right' },
  ms: { keepLeft: 'ikut kiri', keepRight: 'ikut kanan', turnLeft: 'belok kiri', turnRight: 'belok kanan', straight: 'jalan terus', uturn: 'buat pusingan U', exitLeft: 'keluar di sebelah kiri', exitRight: 'keluar di sebelah kanan' },
  zh: { keepLeft: '靠左行驶', keepRight: '靠右行驶', turnLeft: '左转', turnRight: '右转', straight: '继续直行', uturn: '掉头', exitLeft: '从左侧出口驶出', exitRight: '从右侧出口驶出' },
};

/** "use the two left lanes" / "guna dua lorong kiri" / "请走左侧两条车道" */
function lanePhrase(pos: LanePosition, total: number, lang: AppLanguage): string {
  const n = NUM[lang][pos.count] ?? String(pos.count);
  if (lang === 'ms') {
    if (pos.side === 'left') return pos.count === 1 ? 'guna lorong paling kiri' : `guna ${n} lorong kiri`;
    if (pos.side === 'right') return pos.count === 1 ? 'guna lorong paling kanan' : `guna ${n} lorong kanan`;
    if (pos.side === 'middle' && pos.count === 1 && total === 3) return 'guna lorong tengah';
    return `guna lorong ${pos.positions.join(' dan ')} dari kiri`;
  }
  if (lang === 'zh') {
    if (pos.side === 'left') return pos.count === 1 ? '请走最左侧车道' : `请走左侧${n}条车道`;
    if (pos.side === 'right') return pos.count === 1 ? '请走最右侧车道' : `请走右侧${n}条车道`;
    if (pos.side === 'middle' && pos.count === 1 && total === 3) return '请走中间车道';
    return `请走左起第${pos.positions.join('、')}条车道`;
  }
  if (pos.side === 'left') return pos.count === 1 ? 'use the left lane' : `use the ${n} left lanes`;
  if (pos.side === 'right') return pos.count === 1 ? 'use the right lane' : `use the ${n} right lanes`;
  if (pos.side === 'middle' && pos.count === 1 && total === 3) return 'use the middle lane';
  return `use lanes ${pos.positions.join(' and ')} from the left`;
}

/** "In 1 kilometre, keep right, use the two right lanes, towards Kerinchi Link." */
export function laneVoiceCue(opts: {
  meters: number;
  maneuver: Maneuver | null;
  lanes: LanePosition;
  totalLanes: number;
  towards: string | null;
  lang: AppLanguage;
}): string {
  const { meters, maneuver, lanes, totalLanes, towards, lang } = opts;
  const dist = spokenDistance(meters, lang);
  const action = ACTIONS[lang][actionFor(maneuver)];
  const use = lanePhrase(lanes, totalLanes, lang);
  if (lang === 'ms') return `${dist}, ${action}, ${use}${towards ? `, menuju ${towards}` : ''}.`;
  if (lang === 'zh') return `${dist}${action}，${use}${towards ? `，前往 ${towards}` : ''}。`;
  return `${dist}, ${action}, ${use}${towards ? `, towards ${towards}` : ''}.`;
}

export type TollCardStrings = { label: string; notPriced: string; next: string; reminder: (meters: number) => string };

export const TOLL_STRINGS: Record<AppLanguage, TollCardStrings> = {
  en: {
    label: 'Toll',
    notPriced: 'Not priced',
    next: 'Next',
    reminder: (m) => `Toll plaza ${spokenDistance(m, 'en').replace(/^In /, 'in ')}. Get your Touch 'n Go or card ready.`,
  },
  ms: {
    label: 'Tol',
    notPriced: 'Tiada harga',
    next: 'Seterusnya',
    reminder: (m) => `Plaza tol ${spokenDistance(m, 'ms').replace(/^Dalam /, 'dalam ')}, sediakan Touch 'n Go atau kad.`,
  },
  zh: {
    label: '收费站',
    notPriced: '未定价',
    next: '下一个',
    reminder: (m) => `前方${spokenDistance(m, 'zh').replace(/后$/, '')}有收费站，请准备好 Touch 'n Go 或银行卡。`,
  },
};
