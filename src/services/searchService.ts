import { KUALA_LUMPUR, type LngLat } from '../config/malaysia';
import type { QuickCategory } from '../config/quickCategories';
import type { Place } from '../models/place';

/** An error with a plain-English message we can show to the user. */
export class SearchError extends Error {}

/** Results for the same text near the same place are re-used, so typing back and forth costs nothing. */
const cache = new Map<string, Place[]>();

const SEARCHBOX = 'https://api.mapbox.com/search/searchbox/v1';
const GEOCODING = 'https://api.mapbox.com/search/geocode/v6/forward';

/**
 * Tidies Malaysian address input so the search engine reads it well, e.g.
 *   "No. 12, Jalan Example,\nTaman Example,\n50450 Kuala Lumpur,\nMalaysia."
 *   -> "No. 12, Jalan Example, Taman Example, 50450 Kuala Lumpur"
 */
export function normaliseQuery(text: string): string {
  return text
    .replace(/[\r\n]+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/,\s*,+/g, ',')
    .replace(/,?\s*malaysia\.?\s*$/i, '') // results are already limited to Malaysia
    .replace(/[\s,.]+$/, '')
    .trim();
}

/**
 * Words that mean "find me any ... nearby" (English + Bahasa Melayu), mapped to Mapbox
 * category IDs. Each ID was checked against live Malaysian results.
 */
const CATEGORY_WORDS: [RegExp, string][] = [
  [/\b(petrol stations?|petrol|gas stations?|stesen minyak)\b/i, 'gas_station'],
  [/\b(ev charg\w*|charging stations?|ev chargers?)\b/i, 'charging_station'],
  [/\b(clinics?|klinik)\b/i, 'clinic'],
  [/\b(pharmac(y|ies)|farmasi)\b/i, 'pharmacy'],
  [/\b(restaurants?|restoran|kedai makan)\b/i, 'restaurant'],
  [/\b(cafes?|kafe|coffee shops?)\b/i, 'cafe'],
  [/\b(parking|car parks?|tempat letak kereta)\b/i, 'parking_lot'],
  [/\b(hospitals?)\b/i, 'hospital'],
];

/** Common Malaysian short names whose best match in Mapbox data has a different name. */
const ALIASES: Record<string, string[]> = {
  klcc: ['Suria KLCC', 'Petronas Twin Towers'],
  hkl: ['Kuala Lumpur Hospital'],
};

/**
 * Malay names put the type first ("Hospital Kuala Lumpur"), English names put it last
 * ("Kuala Lumpur Hospital"). Mapbox often only knows one, so we also try the other order.
 */
const SWAP_WORDS: Record<string, string> = { hospital: 'Hospital', universiti: 'University', masjid: 'Mosque', stesen: 'Station' };
function swappedName(q: string): string | null {
  const m = q.match(/^(hospital|universiti|masjid|stesen)\s+(.{2,})$/i);
  return m ? `${m[2]} ${SWAP_WORDS[m[1].toLowerCase()]}` : null;
}

const TRANSIT = ['train station', 'bus station', 'bus stop'];

/**
 * Malaysian towns and cities. If the search text names one ("Kuching Waterfront"), results whose
 * address is somewhere else (a "Kuching Waterfront" business in Kajang) are pushed down.
 */
const TOWNS = [
  'kuala lumpur', 'putrajaya', 'cyberjaya', 'shah alam', 'petaling jaya', 'subang jaya', 'klang', 'kajang',
  'seremban', 'melaka', 'malacca', 'johor bahru', 'ipoh', 'george town', 'penang', 'pulau pinang', 'butterworth',
  'alor setar', 'langkawi', 'kota bharu', 'kuala terengganu', 'kuantan', 'genting', 'cameron highlands',
  'kota kinabalu', 'sandakan', 'tawau', 'kuching', 'miri', 'sibu', 'bintulu',
];
const FOOD_SHOP = ['food', 'restaurant', 'chinese restaurant', 'fast food restaurant', 'cafe', 'clothing', 'services', 'office'];

/** POI types that are almost never a driving destination - hidden unless asked for by name. */
const HIDDEN_CATEGORIES = ['bus stop', 'atm', 'real estate agent', 'lawyer'];

const looksLikePostcode = (q: string) => /^\d{5}$/.test(q);
const looksLikeAddress = (q: string) =>
  /^(no\.?|lot|unit)?\s*\d+[a-z]?\b/i.test(q) || /\b(jalan|jln|lorong|lrg|persiaran|lebuh|lebuhraya|taman)\b/i.test(q);

type SearchBoxFeature = {
  geometry: { coordinates: LngLat };
  properties: {
    mapbox_id: string;
    name: string;
    feature_type: string;
    full_address?: string;
    place_formatted?: string;
    poi_category?: string[];
  };
};

function toPlace(f: SearchBoxFeature): Place {
  return {
    id: f.properties.mapbox_id,
    name: f.properties.name,
    address: f.properties.full_address ?? f.properties.place_formatted ?? '',
    kind: f.properties.feature_type,
    category: f.properties.poi_category?.[0] ?? null,
    coordinates: f.geometry.coordinates,
    source: 'mapbox',
  };
}

async function getJson(url: string, signal?: AbortSignal): Promise<{ features?: SearchBoxFeature[] }> {
  let res: Response;
  try {
    res = await fetch(url, { signal });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new SearchError('No internet connection. Check your network and try again.');
  }
  if (!res.ok) {
    if (res.status === 401) throw new SearchError('Mapbox rejected the token (401).');
    if (res.status === 403) throw new SearchError('This website address is not allowed by your token (403).');
    if (res.status === 429) throw new SearchError('Too many searches. Wait a moment and try again.');
    throw new SearchError(`Search service error (${res.status}). Try again later.`);
  }
  return res.json();
}

function common(token: string, near: LngLat, limit: number) {
  return {
    access_token: token,
    country: 'my', // Malaysia only (Peninsular + Sabah + Sarawak)
    language: 'en', // English labels; Malay names like "Menara" / "Jalan" still match
    limit: String(limit),
    proximity: `${near[0]},${near[1]}`, // prefer results near you (or KL if GPS is off)
  };
}

/** Places, malls, airports, hospitals... (Search Box /forward - billed per request). */
async function searchPois(token: string, q: string, near: LngLat, limit: number, signal?: AbortSignal) {
  const p = new URLSearchParams({ q, ...common(token, near, limit), auto_complete: 'true' });
  return ((await getJson(`${SEARCHBOX}/forward?${p}`, signal)).features ?? []).map(toPlace);
}

/** Postcodes, towns, cities, states (Geocoding v6 - 100,000 free requests per month). */
async function searchAreas(token: string, q: string, near: LngLat, signal?: AbortSignal) {
  const p = new URLSearchParams({
    q,
    ...common(token, near, 4),
    autocomplete: 'true',
    types: 'postcode,place,locality,district,region,neighborhood,street,address',
  });
  return ((await getJson(`${GEOCODING}?${p}`, signal)).features ?? []).map(toPlace);
}

/** "Any petrol station near ..." (Search Box /category - billed per request). */
async function searchCategory(token: string, id: string, near: LngLat, signal?: AbortSignal, limit = 8) {
  const p = new URLSearchParams(common(token, near, limit));
  return ((await getJson(`${SEARCHBOX}/category/${id}?${p}`, signal)).features ?? []).map(toPlace);
}

// ---------------- OpenStreetMap (via Geoapify) ----------------
type GeoapifyResult = {
  name?: string;
  street?: string;
  housenumber?: string;
  address_line1?: string;
  address_line2?: string;
  formatted?: string;
  result_type?: string;
  category?: string;
  lat: number;
  lon: number;
  place_id?: string;
};

/** Geoapify result types -> the same "kind" names Mapbox uses, so ranking treats them alike. */
const OSM_KIND: Record<string, string> = {
  street: 'street',
  building: 'address',
  suburb: 'neighborhood',
  district: 'neighborhood',
  city: 'place',
  county: 'district',
  state: 'region',
  postcode: 'postcode',
  amenity: 'poi',
};

/**
 * Streets, neighbourhoods (taman) and landmarks from OpenStreetMap, which Mapbox's
 * Malaysian search data is missing. Geoapify free plan: 3,000 requests/day, results may be
 * shown on any map, credit "Powered by Geoapify" + "© OpenStreetMap contributors" required.
 * Any problem here (no key, quota used up, offline) just means fewer results - never an error.
 */
async function searchOsm(key: string, q: string, near: LngLat, signal?: AbortSignal): Promise<Place[]> {
  const p = new URLSearchParams({
    text: q,
    apiKey: key,
    filter: 'countrycode:my',
    bias: `proximity:${near[0]},${near[1]}`,
    lang: 'en',
    limit: '5',
    format: 'json',
  });
  try {
    const res = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${p}`, { signal });
    if (!res.ok) {
      console.warn('[Terus] OpenStreetMap search unavailable:', res.status);
      return [];
    }
    const data = (await res.json()) as { results?: GeoapifyResult[] };
    return (data.results ?? []).map((r) => {
      const name = r.name ?? r.address_line1 ?? r.street ?? r.formatted ?? 'Unnamed place';
      return {
        id: `osm:${r.place_id ?? `${r.lon},${r.lat}`}`,
        name,
        address: r.address_line2 ?? r.formatted ?? '',
        kind: OSM_KIND[r.result_type ?? ''] ?? 'poi',
        category: r.result_type === 'street' ? 'street' : null,
        coordinates: [r.lon, r.lat],
        source: 'osm' as const,
      };
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    return [];
  }
}

/** Same name within ~100 m = same place (streets: within ~3 km, as long roads appear in pieces). */
function dedupe(places: Place[]): Place[] {
  const out: Place[] = [];
  for (const p of places) {
    const tolerance = p.kind === 'street' ? 0.03 : 0.001; // ~3 km for streets, ~100 m otherwise
    const dup = out.some(
      (o) =>
        o.name.toLowerCase() === p.name.toLowerCase() &&
        Math.abs(o.coordinates[0] - p.coordinates[0]) < tolerance &&
        Math.abs(o.coordinates[1] - p.coordinates[1]) < tolerance,
    );
    if (!dup) out.push(p);
  }
  return out;
}

/**
 * Searches destinations in Malaysia (Peninsular + Sabah + Sarawak), combining:
 *  - Search Box /forward for named places (KLCC, Mid Valley, KLIA, universities...)
 *  - Geocoding v6 for postcodes, towns and cities
 *  - Search Box /category for "petrol station Bangsar", "hospital", "parking"...
 *  - OpenStreetMap via Geoapify (optional key) for street names and neighbourhoods,
 *    which Mapbox's Malaysian search data is missing (tested Nov 2026)
 * Usually 2-3 requests per search; the UI waits until you pause typing.
 * House-number addresses remain weak in both sources - results go to the right street.
 */
export async function searchPlaces(
  token: string,
  rawQuery: string,
  options: { near?: LngLat; signal?: AbortSignal; osmKey?: string | null } = {},
): Promise<Place[]> {
  const query = normaliseQuery(rawQuery);
  if (query.length < 2) return [];
  const { signal, osmKey } = options;
  const near = options.near ?? KUALA_LUMPUR;
  const key = `${query.toLowerCase()}|${near[0].toFixed(2)},${near[1].toFixed(2)}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const lower = query.toLowerCase();
  const category = CATEGORY_WORDS.find(([re]) => re.test(query));
  const swapped = swappedName(query);
  const aliases = [...(ALIASES[lower] ?? []), ...(swapped ? [swapped] : [])];

  const [pois, areas, aliasResults, categoryResults, osm] = await Promise.all([
    searchPois(token, query, near, 8, signal),
    searchAreas(token, query, near, signal),
    Promise.all(aliases.map((a) => searchPois(token, a, near, 2, signal))).then((r) => r.flat()),
    (async () => {
      if (!category) return [];
      // "petrol station Bangsar" -> find "Bangsar" first, then petrol stations around it.
      const placeWords = query.replace(category[0], ' ').replace(/\b(near|in|at|dekat|di)\b/gi, ' ').replace(/\s+/g, ' ').trim();
      let anchor = near;
      if (placeWords.length >= 2) {
        const found = await searchPois(token, placeWords, near, 1, signal);
        if (found[0]) anchor = found[0].coordinates;
      }
      return searchCategory(token, category[1], anchor, signal);
    })(),
    // OpenStreetMap only for 3+ characters, to save the free daily quota.
    osmKey && query.length >= 3 && !category ? searchOsm(osmKey, query, near, signal) : Promise.resolve([]),
  ]);

  // ---- Ranking: score each result, keep the original order for ties ----
  const asksForTransit = /\b(station|stesen|lrt|mrt|ktm|monorail|bus)\b/i.test(query);
  const aliasNames = aliases.map((a) => a.toLowerCase());
  const townsInQuery = TOWNS.filter((t) => lower.includes(t) && lower !== t);
  const score = (p: Place): number => {
    const name = p.name.toLowerCase();
    let s = 0;
    if (name === lower || aliasNames.includes(name)) s += 50; // exact name
    else if (name.startsWith(lower)) s += 15;
    if (['place', 'region', 'district', 'locality'].includes(p.kind) && name === lower) s += 45; // a town/city: "Ipoh"
    if (p.kind === 'postcode' && looksLikePostcode(query)) s += 60;
    if (['street', 'neighborhood'].includes(p.kind) && name === lower) s += 45; // "Jalan Tuanku Abdul Rahman", "Taman Tun Dr Ismail"
    if ((looksLikeAddress(query) || looksLikePostcode(query)) && p.kind !== 'poi') s += 20;
    if (category && categoryResults.includes(p)) s += 30; // "petrol station ..." -> petrol stations
    if (p.category && TRANSIT.includes(p.category) && !asksForTransit) s -= 30;
    if (p.category && FOOD_SHOP.includes(p.category) && name !== lower) s -= 10; // "Ipoh Ais Kopi" for "Ipoh"
    if (townsInQuery.length && !townsInQuery.some((t) => p.address.toLowerCase().includes(t))) s -= 25; // wrong town
    return s;
  };

  const wantsHidden = (p: Place) => !p.category || !HIDDEN_CATEGORIES.includes(p.category) || lower.includes(p.category);
  const candidates = dedupe([...aliasResults, ...categoryResults, ...pois, ...areas, ...osm].filter(wantsHidden));
  const places = candidates
    .map((p, i) => ({ p, i, s: score(p) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.p)
    .slice(0, 10);
  cache.set(key, places);
  return places;
}

// ---------------- Recent destinations (saved on this device only) ----------------
// Old name kept on purpose so recent places survive the rename to Terus.
const RECENTS_KEY = 'novanav.recentPlaces';

export function loadRecentPlaces(): Place[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as Place[]).slice(0, 6) : [];
  } catch {
    return []; // storage can be unavailable (private mode) - just show none
  }
}

export function saveRecentPlace(place: Place): void {
  try {
    const list = [place, ...loadRecentPlaces().filter((p) => p.id !== place.id)].slice(0, 6);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function clearRecentPlaces(): void {
  try {
    localStorage.removeItem(RECENTS_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * A place for a point picked by long-pressing the map. The pin stays exactly where it was
 * pressed; the lookup only gives it a name:
 *  1. OpenStreetMap via Geoapify reverse geocoding (best Malaysian street addresses; 3,000 free/day)
 *  2. Mapbox Geocoding (often only a postcode + city in Malaysia)
 *  3. "Dropped pin" + coordinates
 */
export async function placeFromPoint(token: string, coordinates: LngLat, osmKey: string | null = null): Promise<Place> {
  const [lng, lat] = coordinates;
  const fallback: Place = {
    id: `pin:${lng.toFixed(6)},${lat.toFixed(6)}`,
    name: 'Dropped pin',
    address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
    kind: 'pin',
    category: null,
    coordinates,
    source: 'pin',
  };
  if (osmKey) {
    try {
      const res = await fetch(`https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&lang=en&apiKey=${osmKey}`);
      if (res.ok) {
        const data = (await res.json()) as {
          features?: { properties?: { name?: string; street?: string; housenumber?: string; formatted?: string } }[];
        };
        const p = data.features?.[0]?.properties;
        const street = [p?.housenumber, p?.street].filter(Boolean).join(' ');
        const name = p?.name || street;
        if (name) return { ...fallback, name, address: (p?.formatted ?? '').replace(/, KUL, Malaysia$|, Malaysia$/, '') || fallback.address };
      }
    } catch {
      /* try Mapbox next */
    }
  }
  try {
    const params = new URLSearchParams({ longitude: String(lng), latitude: String(lat), language: 'en', access_token: token });
    const res = await fetch(`https://api.mapbox.com/search/geocode/v6/reverse?${params}`);
    if (!res.ok) return fallback;
    const data = (await res.json()) as { features?: { properties?: { feature_type?: string; full_address?: string; place_formatted?: string } }[] };
    const p = data.features?.[0]?.properties;
    // Usually only "55100, Kuala Lumpur" here - good as an address line, not as a name.
    return p?.full_address ? { ...fallback, address: p.full_address.replace(/, Malaysia$/, '') } : fallback;
  } catch {
    return fallback;
  }
}

// ---------------- Quick search buttons ("Petrol", "Hospital"...) ----------------
type GeoapifyPlace = {
  geometry: { coordinates: LngLat };
  properties: { place_id: string; name?: string; street?: string; housenumber?: string; address_line2?: string; formatted?: string };
};

/** OpenStreetMap places of a category within ~8 km (Geoapify Places API, free plan). */
async function searchOsmCategory(osmKey: string, cat: QuickCategory, near: LngLat, signal?: AbortSignal): Promise<Place[]> {
  const p = new URLSearchParams({
    categories: cat.osm,
    filter: `circle:${near[0]},${near[1]},8000`,
    bias: `proximity:${near[0]},${near[1]}`,
    limit: '20',
    lang: 'en',
    apiKey: osmKey,
  });
  const res = await fetch(`https://api.geoapify.com/v2/places?${p}`, { signal });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: GeoapifyPlace[] };
  return (data.features ?? []).map((f) => {
    const street = [f.properties.housenumber, f.properties.street].filter(Boolean).join(' ');
    return {
      id: `osm:${f.properties.place_id}`,
      // Car parks, toilets and ATMs often have no name in the map data.
      name: f.properties.name || cat.fallbackName,
      address: ((f.properties.name ? f.properties.address_line2 : street || f.properties.address_line2) ?? f.properties.formatted ?? '').replace(/, Malaysia$/, ''),
      kind: 'poi',
      category: cat.fallbackName.toLowerCase(),
      coordinates: f.geometry.coordinates,
      source: 'osm',
    } satisfies Place;
  });
}

/**
 * Nearest places for a quick search button: OpenStreetMap (Geoapify) + Mapbox, merged,
 * duplicates removed (same name within ~100 m, or any two within ~15 m), nearest first.
 */
export async function searchNearby(
  token: string,
  osmKey: string | null,
  cat: QuickCategory,
  near: LngLat,
  signal?: AbortSignal,
): Promise<Place[]> {
  const [osm, mapbox] = await Promise.all([
    osmKey ? searchOsmCategory(osmKey, cat, near, signal).catch((e) => (e.name === 'AbortError' ? Promise.reject(e) : [])) : [],
    cat.mapbox
      ? searchCategory(token, cat.mapbox, near, signal, 15).catch((e) => (e.name === 'AbortError' || !osmKey ? Promise.reject(e) : []))
      : [],
  ]);
  const dist = (p: Place) => Math.hypot((p.coordinates[0] - near[0]) * Math.cos((near[1] * Math.PI) / 180), p.coordinates[1] - near[1]);
  const merged: Place[] = [];
  for (const p of [...osm, ...mapbox].sort((a, b) => dist(a) - dist(b))) {
    const close = (o: Place, deg: number) =>
      Math.abs(o.coordinates[0] - p.coordinates[0]) < deg && Math.abs(o.coordinates[1] - p.coordinates[1]) < deg;
    const dup = merged.some((o) => close(o, 0.00015) || (close(o, 0.001) && o.name.toLowerCase() === p.name.toLowerCase()));
    if (!dup) merged.push(p);
  }
  return merged.slice(0, 20);
}
