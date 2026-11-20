// Fetches official MET Malaysia / JPS data from data.gov.my, checks every field at runtime
// (the API has renamed fields before), and caches answers in memory + localStorage so the app
// stays within fair use and still works on a poor connection.
// Nothing here throws to the caller: on any failure the functions return null.

import {
  CACHE_MINUTES,
  FLOOD_STATION_FIELDS,
  HAZARD_ENDPOINTS,
  HAZARD_TIMEOUT_MS,
} from '../config/hazardSources';

// ---------- Cleaned-up models (what the rest of the app uses) ----------

export type MetWarning = {
  issued: string; // ISO with +08:00
  titleEn: string;
  titleMs: string;
  validFrom: string | null;
  validTo: string | null;
  headingEn: string;
  headingMs: string;
  textEn: string;
  textMs: string;
  instructionEn: string;
  instructionMs: string;
  /** Fake warning from ?demo=flood */
  demo?: boolean;
};

export type FloodLevel = 'NORMAL' | 'ALERT' | 'WARNING' | 'DANGER' | 'ERROR' | 'UNKNOWN';

export type FloodStation = {
  id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  district: string;
  state: string;
  level: FloodLevel;
  trend: string;
  /** ISO with +08:00, or null if missing */
  updatedAt: string | null;
  /** Fake station from ?demo=flood */
  demo?: boolean;
};

export type ForecastDay = {
  locationId: string;
  locationName: string;
  date: string;
  morning: string;
  afternoon: string;
  night: string;
  summary: string;
  summaryWhen: string;
  minTemp: number | null;
  maxTemp: number | null;
};

// ---------- Runtime validation helpers ----------

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '');
const num = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
  return Number.isFinite(n) && n !== -9999 ? n : null; // -9999 = sensor fault (per the docs)
};
/** First non-empty value among several possible field names (handles renamed fields). */
const pick = (o: Json, ...keys: string[]): unknown => {
  for (const k of keys) {
    if (o[k] !== undefined && o[k] !== null && o[k] !== '') return o[k];
  }
  return undefined;
};

/** data.gov.my times have no time zone; they are Malaysia time (UTC+8). Returns ISO with +08:00. */
export function myTimeToIso(v: unknown): string | null {
  const s = str(v);
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?/);
  if (!m) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(s)) return new Date(s).toISOString();
  return `${m[1]}T${m[2]}${m[3] ?? ':00'}+08:00`;
}

export function parseWarnings(raw: unknown): MetWarning[] {
  if (!Array.isArray(raw)) return [];
  const out: MetWarning[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const issue = isObj(r.warning_issue) ? r.warning_issue : {};
    const issued = myTimeToIso(pick(issue, 'issued') ?? pick(r, 'warning_issue__issued', 'issued'));
    if (!issued) continue;
    out.push({
      issued,
      titleEn: str(pick(issue, 'title_en') ?? pick(r, 'warning_issue__title_en', 'title_en')),
      titleMs: str(pick(issue, 'title_bm') ?? pick(r, 'warning_issue__title_bm', 'title_bm')),
      validFrom: myTimeToIso(r.valid_from),
      validTo: myTimeToIso(r.valid_to),
      headingEn: str(r.heading_en),
      headingMs: str(pick(r, 'heading_bm', 'heading_ms')),
      textEn: str(r.text_en),
      textMs: str(pick(r, 'text_bm', 'text_ms')),
      instructionEn: str(r.instruction_en),
      instructionMs: str(pick(r, 'instruction_bm', 'instruction_ms')),
    });
  }
  return out;
}

const LEVELS: FloodLevel[] = ['NORMAL', 'ALERT', 'WARNING', 'DANGER', 'ERROR'];

export function parseFloodStations(raw: unknown): FloodStation[] {
  if (!Array.isArray(raw)) return [];
  const out: FloodStation[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const name = str(pick(r, 'station_name', 'name'));
    if (!name) continue;
    const lvl = str(pick(r, 'water_level_indicator', 'water_level_status_indicator')).toUpperCase();
    out.push({
      id: str(pick(r, 'station_id', 'station_code')) || name,
      name,
      lat: num(pick(r, 'latitude', 'lat')),
      lng: num(pick(r, 'longitude', 'lon', 'lng')),
      district: str(r.district),
      state: str(r.state),
      level: (LEVELS as string[]).includes(lvl) ? (lvl as FloodLevel) : 'UNKNOWN',
      trend: str(r.water_level_trend),
      updatedAt: myTimeToIso(pick(r, 'water_level_update_datetime', 'updated_at')),
    });
  }
  return out;
}

export function parseForecast(raw: unknown): ForecastDay[] {
  if (!Array.isArray(raw)) return [];
  const out: ForecastDay[] = [];
  for (const r of raw) {
    if (!isObj(r)) continue;
    const loc = isObj(r.location) ? r.location : {};
    const date = str(r.date);
    const locationName = str(pick(loc, 'location_name') ?? pick(r, 'location__location_name'));
    if (!date || !locationName) continue;
    out.push({
      locationId: str(pick(loc, 'location_id') ?? pick(r, 'location__location_id')),
      locationName,
      date,
      morning: str(r.morning_forecast),
      afternoon: str(r.afternoon_forecast),
      night: str(r.night_forecast),
      summary: str(r.summary_forecast),
      summaryWhen: str(r.summary_when),
      minTemp: num(r.min_temp),
      maxTemp: num(r.max_temp),
    });
  }
  return out;
}

// ---------- Cache + fetch ----------

type Entry = { t: number; data: unknown };
const memory = new Map<string, Entry>();
const STORE_PREFIX = 'terus.hazardCache.';

function readCache(key: string, maxAgeMin: number): unknown | undefined {
  let e = memory.get(key);
  if (!e) {
    try {
      const s = localStorage.getItem(STORE_PREFIX + key);
      if (s) {
        const parsed: unknown = JSON.parse(s);
        if (isObj(parsed) && typeof parsed.t === 'number') e = { t: parsed.t, data: parsed.data };
      }
    } catch {
      /* storage unavailable */
    }
  }
  if (!e) return undefined;
  memory.set(key, e);
  return Date.now() - e.t <= maxAgeMin * 60_000 ? e.data : undefined;
}

function writeCache(key: string, data: unknown): void {
  const e = { t: Date.now(), data };
  memory.set(key, e);
  try {
    localStorage.setItem(STORE_PREFIX + key, JSON.stringify(e));
  } catch {
    /* full or private mode - memory cache still works */
  }
}

/** Stale copy (any age) - used when the network fails. */
function readStale(key: string): unknown | undefined {
  return memory.get(key)?.data ?? readCache(key, Number.POSITIVE_INFINITY);
}

function logDev(msg: string, err?: unknown): void {
  if (import.meta.env.DEV) console.warn(`[Terus hazards] ${msg}`, err ?? '');
}

const inflight = new Map<string, Promise<unknown | null>>();

async function getJson(key: string, url: string, maxAgeMin: number): Promise<unknown | null> {
  const cached = readCache(key, maxAgeMin);
  if (cached !== undefined) return cached;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), HAZARD_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: unknown = await res.json();
      writeCache(key, data);
      return data;
    } catch (err) {
      logDev(`${key} failed - using cached copy if any`, err);
      return readStale(key) ?? null;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, p);
  return p;
}

/** All current MET Malaysia warnings (null if unavailable). */
export async function fetchWarnings(): Promise<MetWarning[] | null> {
  const raw = await getJson('warnings', HAZARD_ENDPOINTS.warnings, CACHE_MINUTES.warnings);
  return raw === null ? null : parseWarnings(raw);
}

/** River stations in one state (state name as data.gov.my writes it, e.g. "SELANGOR"). */
export async function fetchFloodStations(state: string): Promise<FloodStation[] | null> {
  const q = new URLSearchParams({ contains: `${state}@state`, include: FLOOD_STATION_FIELDS.join(',') });
  const raw = await getJson(`flood.${state}`, `${HAZARD_ENDPOINTS.floodStations}?${q}`, CACHE_MINUTES.floodStations);
  return raw === null ? null : parseFloodStations(raw);
}

/** 7-day forecast rows whose location name contains `name` (district or town). */
export async function fetchForecast(name: string): Promise<ForecastDay[] | null> {
  const q = new URLSearchParams({ contains: `${name}@location__location_name` });
  const raw = await getJson(`forecast.${name.toLowerCase()}`, `${HAZARD_ENDPOINTS.forecast}?${q}`, CACHE_MINUTES.forecast);
  return raw === null ? null : parseForecast(raw);
}
