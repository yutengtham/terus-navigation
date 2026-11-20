// Place-name helpers for matching official warnings to the route.
// Warnings, river stations and the DOSM boundary file each spell places differently
// ("W.P. Kuala Lumpur", "WILAYAH PERSEKUTUAN KUALA LUMPUR", "Ulu Langat" / "Hulu Langat").

/** Lower-case, no accents/punctuation, common prefixes/suffixes removed, spelling variants unified. */
export function normaliseArea(name: string): string {
  let s = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\(wpkl\)/g, ' ')
    .replace(/\bw\.\s*p\.?|\bwp\b|\bwilayah persekutuan\b|\bfederal territory( of)?\b/g, ' ')
    .replace(/\bs\.\s*p\.?(?=\s)/g, 'seberang perai ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\bsp\b/g, 'seberang perai')
    .replace(/\b(district|daerah|division|bahagian|state|negeri)\b/g, ' ')
    .replace(/\bulu\b/g, 'hulu')
    .replace(/\bsg\b/g, 'sungai')
    .replace(/\bpenang\b/g, 'pulau pinang')
    .replace(/\bmalacca\b/g, 'melaka')
    .replace(/\s+/g, ' ')
    .trim();
  // "Timur Laut Pulau Pinang" (JPS) = "Timur Laut" (DOSM)
  s = s.replace(/^(timur laut|barat daya) pulau pinang$/, '$1');
  // "Larut Matang dan Selama" (JPS) vs "Larut Dan Matang" (DOSM)
  s = s.replace(/^larut (dan )?matang( dan selama)?$/, 'larut matang');
  return s;
}

/** Canonical state keys (normalised), with aliases used by MET / JPS / DOSM. */
const STATE_ALIASES: Record<string, string[]> = {
  johor: ['johor', 'johor darul tazim'],
  kedah: ['kedah'],
  kelantan: ['kelantan'],
  melaka: ['melaka'],
  'negeri sembilan': ['negeri sembilan', 'sembilan'],
  pahang: ['pahang'],
  perak: ['perak'],
  perlis: ['perlis'],
  'pulau pinang': ['pulau pinang'],
  sabah: ['sabah'],
  sarawak: ['sarawak'],
  selangor: ['selangor'],
  terengganu: ['terengganu'],
  'kuala lumpur': ['kuala lumpur', 'kl'],
  labuan: ['labuan'],
  putrajaya: ['putrajaya'],
};

/** "W.P. Kuala Lumpur" / "WILAYAH PERSEKUTUAN KUALA LUMPUR" -> "kuala lumpur"; null if not a state. */
export function stateKey(name: string): string | null {
  const n = normaliseArea(name);
  for (const [key, aliases] of Object.entries(STATE_ALIASES)) {
    if (aliases.includes(n)) return key;
  }
  return null;
}

/** How the JPS flood feed writes each state (for its `contains=...@state` filter). */
export function floodApiState(key: string): string {
  if (key === 'kuala lumpur' || key === 'labuan' || key === 'putrajaya') return `WILAYAH PERSEKUTUAN ${key.toUpperCase()}`;
  return key.toUpperCase();
}

/** Same place? Exact match after normalising, or one is the other plus extra whole words. */
export function sameArea(a: string, b: string): boolean {
  const x = normaliseArea(a);
  const y = normaliseArea(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 4 && (long.startsWith(short + ' ') || long.endsWith(' ' + short));
}

// Sabah divisions named in MET warnings -> districts (DOSM names). Sarawak divisions share
// the name of their main district, so they match that district directly.
const SABAH_DIVISIONS: Record<string, string[]> = {
  'west coast': ['Kota Kinabalu', 'Penampang', 'Putatan', 'Papar', 'Tuaran', 'Kota Belud', 'Ranau'],
  'pantai barat': ['Kota Kinabalu', 'Penampang', 'Putatan', 'Papar', 'Tuaran', 'Kota Belud', 'Ranau'],
  interior: ['Keningau', 'Tambunan', 'Tenom', 'Nabawan', 'Beaufort', 'Kuala Penyu', 'Sipitang'],
  pedalaman: ['Keningau', 'Tambunan', 'Tenom', 'Nabawan', 'Beaufort', 'Kuala Penyu', 'Sipitang'],
};

/** An area named in a warning: a whole state, or some districts / towns in it. */
export type WarningArea = { state: string; places: string[] };

/** Splits on commas / "and" / "dan" that are not inside brackets. */
function splitTopLevel(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  const flush = () => {
    if (cur.trim()) out.push(cur.trim());
    cur = '';
  };
  const words = s.split(/(\s+|,|\(|\))/);
  for (const w of words) {
    if (w === '(') depth++;
    if (w === ')') depth = Math.max(0, depth - 1);
    if (depth === 0 && (w === ',' || /^(and|dan)$/i.test(w.trim()))) {
      flush();
      continue;
    }
    cur += w;
  }
  flush();
  return out;
}

/** "Sandakan (Telupid and Paitan)" -> ["Telupid", "Paitan"]; "Kudat" -> ["Kudat"]; divisions expanded. */
function placesOf(item: string): string[] {
  const m = item.match(/^([^(]+)\(([^)]*)\)/);
  const names = m ? splitTopLevel(m[2]) : [item];
  const out: string[] = [];
  for (const n of names) {
    const clean = n.replace(/[.;:]+$/g, '').trim();
    if (!clean) continue;
    const division = SABAH_DIVISIONS[normaliseArea(clean)];
    out.push(...(division ?? [clean]));
  }
  return out;
}

/** Sentences about the sea (marine / shipping sections) don't affect roads. */
const MARINE = /\b(waters?|perairan|nautical|nautika|shipping|perkapalan|seas?|laut bergelora|ombak|waves?)\b/i;

/**
 * Reads the land areas out of a MET warning text, in English or Malay. Typical text:
 * "...expected over the states of Sarawak: Limbang • Sabah: Sandakan (Telupid and Paitan), Kudat until 3:00 PM"
 * "...dijangka di negeri Selangor: Gombak, Petaling • Kuala Lumpur • Putrajaya sehingga 6:00 petang"
 */
export function parseWarningAreas(text: string): WarningArea[] {
  const areas: WarningArea[] = [];
  // Work sentence by sentence (also split the numbered "1) ... 2) ..." items).
  // Protect abbreviations so "W.P. Kuala Lumpur" or "Sg. Buloh" don't end a sentence.
  const safe = text.replace(/\b([WS])\.\s*P\./gi, '$1P').replace(/\b(Sg|Kg|Bt|Jln|Tmn|Bdr|Pt|Tg|Kpg|Dr|St)\./gi, '$1');
  const sentences = safe.split(/(?<=[.!])\s+|\s(?=\d\)\s)|SECTION [A-Z]:|SEKSYEN [A-Z]:/i);
  for (const sentence of sentences) {
    if (!sentence || MARINE.test(sentence)) continue;
    const start = sentence.match(/\b(?:over the states? of|over|in the states? of|di negeri|di kawasan|di)\s+/i);
    if (!start || start.index === undefined) continue;
    let body = sentence.slice(start.index + start[0].length);
    body = body.split(/\b(?:until|sehingga|from|bermula|mulai)\b/i)[0] ?? '';
    for (const chunk of body.split(/•|;|•/)) {
      const c = chunk.trim().replace(/[.]+$/, '');
      if (!c) continue;
      const colon = c.indexOf(':');
      const head = colon >= 0 ? c.slice(0, colon) : c;
      const key = stateKey(head.replace(/\(.*$/, ''));
      if (!key) continue; // not a state name - ignore rather than guess
      const rest = colon >= 0 ? c.slice(colon + 1) : (c.match(/\(([^)]*)\)/)?.[1] ?? '');
      const places = rest ? splitTopLevel(rest).flatMap(placesOf) : [];
      areas.push({ state: key, places });
    }
  }
  return areas;
}
