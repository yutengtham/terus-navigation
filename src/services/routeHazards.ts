// Matches official MET Malaysia warnings and JPS river stations to a route.
// Terus never makes its own flood prediction: it only places official alerts on the route.
//
// How it works:
// 1. Sample the route every ~2 km and look up each sample's district (bundled DOSM boundaries).
// 2. Warnings name states / districts in their text -> match them to the samples (and check the
//    warning's valid time against "now" and the trip's arrival time).
// 3. River stations at ALERT / WARNING / DANGER within 3 km of the route (fresh readings only).

import type { LngLat } from '../config/malaysia';
import {
  FLOOD_READING_MAX_AGE_H,
  FLOOD_STATION_NEAR_KM,
  ROUTE_SAMPLE_KM,
} from '../config/hazardSources';
import type { DestinationForecast, HazardReport, HazardSeverity, HazardType, RouteHazard } from '../models/hazard';
import { measureLine, pointAlong, snapToLine, type MeasuredLine } from '../utils/geo';
import { floodApiState, parseWarningAreas, sameArea, stateKey } from './areaNames';
import {
  fetchFloodStations,
  fetchForecast,
  fetchWarnings,
  type FloodStation,
  type ForecastDay,
  type MetWarning,
} from './dataGovMy';

/** A flood station closer than this counts as ON the route (route card tag, red segment). */
export const FLOOD_ON_ROUTE_M = 200;

// ---------- District lookup ----------

export type District = { name: string; state: string; stateLabel: string; rings: LngLat[][]; bbox: [number, number, number, number] };

/** Turns the bundled boundary JSON into District records (validated, never throws). */
export function buildDistricts(raw: unknown): District[] {
  const list = typeof raw === 'object' && raw !== null && 'districts' in raw ? (raw as { districts: unknown }).districts : null;
  if (!Array.isArray(list)) return [];
  const out: District[] = [];
  for (const d of list) {
    if (typeof d !== 'object' || d === null) continue;
    const { s, d: name, p } = d as { s?: unknown; d?: unknown; p?: unknown };
    if (typeof s !== 'string' || typeof name !== 'string' || !Array.isArray(p)) continue;
    const rings: LngLat[][] = [];
    for (const poly of p) {
      const outer: unknown = Array.isArray(poly) ? poly[0] : null;
      if (!Array.isArray(outer)) continue;
      const ring = outer.filter((c): c is LngLat => Array.isArray(c) && typeof c[0] === 'number' && typeof c[1] === 'number');
      if (ring.length >= 4) rings.push(ring);
    }
    if (!rings.length) continue;
    const xs = rings.flat().map((c) => c[0]);
    const ys = rings.flat().map((c) => c[1]);
    const key = stateKey(s);
    if (!key) continue;
    out.push({ name, state: key, stateLabel: s.replace(/^W\.P\.\s*/, ''), rings, bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
  }
  return out;
}

let districtsPromise: Promise<District[]> | null = null;
/** Loads the boundary file only when hazards are first checked (keeps the main download small). */
export function loadDistricts(): Promise<District[]> {
  districtsPromise ??= import('../config/data/my-districts.json')
    .then((m) => buildDistricts(m.default))
    .catch(() => {
      districtsPromise = null;
      return [];
    });
  return districtsPromise;
}

function inRing(p: LngLat, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function districtAt(p: LngLat, districts: District[]): District | null {
  for (const d of districts) {
    const [x0, y0, x1, y1] = d.bbox;
    if (p[0] < x0 || p[0] > x1 || p[1] < y0 || p[1] > y1) continue;
    if (d.rings.some((r) => inRing(p, r))) return d;
  }
  return null;
}

// ---------- Route samples ----------

export type RouteSample = { alongKm: number; point: LngLat; district: District | null };

/** A point every `stepKm` along the route (plus the end), each with its district. */
export function sampleRoute(line: MeasuredLine, districts: District[], stepKm = ROUTE_SAMPLE_KM): RouteSample[] {
  const out: RouteSample[] = [];
  const lengthKm = line.length / 1000;
  for (let km = 0; km < lengthKm; km += stepKm) {
    const point = pointAlong(line, km * 1000);
    out.push({ alongKm: km, point, district: districtAt(point, districts) });
  }
  const end = line.coords[line.coords.length - 1];
  if (end) out.push({ alongKm: lengthKm, point: end, district: districtAt(end, districts) });
  return out;
}

// ---------- Warnings ----------

/** Warning type + severity from MET's own wording (English and Malay). null = not a land hazard. */
export function classifyWarning(w: MetWarning): { type: HazardType; severity: HazardSeverity } | null {
  const t = `${w.titleEn} ${w.headingEn} ${w.titleMs} ${w.headingMs}`.toLowerCase();
  if (!t.trim() || /no advisory|tiada (amaran|nasihat)/.test(t)) return null;
  const severity: HazardSeverity = /danger|bahaya|third category|kategori ketiga/.test(t)
    ? 'danger'
    : /severe|bad weather|buruk|second category|kategori kedua/.test(t)
      ? 'warning'
      : 'advisory';
  if (/flood|banjir/.test(t)) return { type: 'flood', severity };
  if (/heavy rain|continuous rain|hujan lebat|hujan berterusan/.test(t)) return { type: 'heavy_rain', severity };
  if (/thunderstorm|ribut petir/.test(t)) return { type: 'thunderstorm', severity };
  if (/strong wind|angin kencang/.test(t)) return { type: 'wind', severity };
  return { type: 'other', severity };
}

/** Is the warning active at any time between now and the end of the trip? */
export function activeInWindow(from: string | null, to: string | null, issued: string, now: number, tripEnd: number): boolean {
  const start = Date.parse(from ?? issued);
  const end = to ? Date.parse(to) : Number.POSITIVE_INFINITY;
  if (Number.isNaN(start)) return false;
  return end >= now && start <= tripEnd;
}

/** Groups matching sample indexes into runs of consecutive samples. */
function runsOf(indexes: number[]): number[][] {
  const runs: number[][] = [];
  for (const i of indexes) {
    const last = runs[runs.length - 1];
    if (last && i === last[last.length - 1] + 1) last.push(i);
    else runs.push([i]);
  }
  return runs;
}

/** Route stretches (km) covered by the samples in one run, padded by half a sample step. */
export function segmentFor(run: RouteSample[], routeKm: number, stepKm = ROUTE_SAMPLE_KM): { startKm: number; endKm: number } {
  const first = run[0].alongKm;
  const last = run[run.length - 1].alongKm;
  return { startKm: Math.max(0, first - stepKm / 2), endKm: Math.min(routeKm, last + stepKm / 2) };
}

export function warningHazards(w: MetWarning, samples: RouteSample[], routeKm: number, now: number, tripEnd: number): RouteHazard[] {
  const kind = classifyWarning(w);
  if (!kind || !activeInWindow(w.validFrom, w.validTo, w.issued, now, tripEnd)) return [];
  const areas = [...parseWarningAreas(w.textEn), ...parseWarningAreas(w.textMs)];
  if (!areas.length) return [];
  const hits: number[] = [];
  samples.forEach((s, i) => {
    const d = s.district;
    if (!d) return;
    const match = areas.some((a) => a.state === d.state && (a.places.length === 0 || a.places.some((p) => sameArea(p, d.name))));
    if (match) hits.push(i);
  });
  return runsOf(hits).map((run, k) => {
    const rs = run.map((i) => samples[i]);
    const segment = segmentFor(rs, routeKm);
    const names = rs.map((s) => s.district?.name.replace(/^W\.P\.\s*/, '') ?? '');
    const states = rs.map((s) => s.district?.stateLabel ?? '');
    const area = [...new Set([...names, ...states].filter(Boolean))].join(', ');
    return {
      id: `met:${w.issued}:${w.headingEn || w.titleEn}:${k}`,
      type: kind.type,
      severity: kind.severity,
      title: { en: w.titleEn || w.headingEn, ms: w.titleMs || w.headingMs || undefined },
      source: 'MET Malaysia',
      issuedAt: w.issued,
      validUntil: w.validTo,
      affectedArea: area,
      distanceAlongRouteKm: segment.startKm,
      segment,
      detail: w.instructionEn || undefined,
      demo: w.demo,
    } satisfies RouteHazard;
  });
}

// ---------- River stations ----------

const STATION_SEVERITY: Partial<Record<FloodStation['level'], HazardSeverity>> = {
  ALERT: 'advisory',
  WARNING: 'warning',
  DANGER: 'danger',
};

const LEVEL_WORDS: Record<HazardSeverity, { en: string; ms: string; zh: string }> = {
  advisory: { en: 'alert', ms: 'waspada', zh: '警戒' },
  warning: { en: 'warning', ms: 'amaran', zh: '警告' },
  danger: { en: 'danger', ms: 'bahaya', zh: '危险' },
};

/** Is a reading recent enough to show? (The feed stopped updating in Feb 2024.) */
export function isFresh(updatedAt: string | null, now: number, maxAgeH = FLOOD_READING_MAX_AGE_H): boolean {
  if (!updatedAt) return false;
  const t = Date.parse(updatedAt);
  return !Number.isNaN(t) && now - t <= maxAgeH * 3600_000 && t <= now + 600_000;
}

export type StationMatch = { hazard: RouteHazard; offsetM: number };

export function stationHazards(stations: FloodStation[], line: MeasuredLine, samples: RouteSample[], now: number): StationMatch[] {
  const routeKm = line.length / 1000;
  const xs = line.coords.map((c) => c[0]);
  const ys = line.coords.map((c) => c[1]);
  const pad = FLOOD_STATION_NEAR_KM / 100; // ~3 km in degrees, generous
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad];
  const out: StationMatch[] = [];
  for (const st of stations) {
    const severity = STATION_SEVERITY[st.level];
    if (!severity || !isFresh(st.updatedAt, now)) continue;
    let along: number | null = null;
    let offsetM = 0;
    let location: LngLat | undefined;
    if (st.lat !== null && st.lng !== null) {
      location = [st.lng, st.lat];
      if (location[0] < box[0] || location[0] > box[2] || location[1] < box[1] || location[1] > box[3]) continue;
      const snap = snapToLine(line, location);
      if (snap.offset > FLOOD_STATION_NEAR_KM * 1000) continue;
      along = snap.along / 1000;
      offsetM = snap.offset;
    } else {
      // No coordinates: match by district name instead.
      const hit = samples.find((s) => s.district && sameArea(s.district.name, st.district) && stateKey(st.state) === s.district.state);
      if (!hit) continue;
      along = hit.alongKm;
      offsetM = FLOOD_STATION_NEAR_KM * 1000;
    }
    const w = LEVEL_WORDS[severity];
    // Short titles: "Flood danger" / "Banjir: bahaya" / "水灾：危险"; the station name goes in the place line.
    const segment = { startKm: Math.max(0, along - 1), endKm: Math.min(routeKm, along + 1) };
    out.push({
      offsetM,
      hazard: {
        id: `jps:${st.id}`,
        type: 'flood',
        severity,
        title: {
          en: `Flood ${w.en}`,
          ms: `Banjir: ${w.ms}`,
          zh: `水灾：${w.zh}`,
        },
        source: 'JPS / data.gov.my',
        issuedAt: st.updatedAt ?? new Date(now).toISOString(),
        validUntil: null,
        affectedArea: [st.name, st.district].filter(Boolean).join(', '),
        distanceAlongRouteKm: segment.startKm,
        segment,
        location,
        detail: st.trend ? `Water level trend: ${st.trend.toLowerCase().replace('_', ' ')}` : undefined,
        demo: st.demo,
      },
    });
  }
  return out;
}

// ---------- Putting it together ----------

export type HazardInput = {
  line: MeasuredLine;
  samples: RouteSample[];
  warnings: MetWarning[];
  stations: FloodStation[];
  now: number;
  /** Trip duration in seconds (ETA window) */
  etaSeconds: number;
};

export type RouteHazardResult = { hazards: RouteHazard[]; floodOnRoute: boolean };

/** Pure matching step (no network) - used by the app and by the dev checks. */
export function buildHazards(input: HazardInput): RouteHazardResult {
  const { line, samples, warnings, stations, now, etaSeconds } = input;
  const routeKm = line.length / 1000;
  const tripEnd = now + etaSeconds * 1000;
  const fromWarnings = warnings.flatMap((w) => warningHazards(w, samples, routeKm, now, tripEnd));
  const fromStations = stationHazards(stations, line, samples, now);
  const floodOnRoute =
    fromStations.some((m) => m.offsetM <= FLOOD_ON_ROUTE_M && m.hazard.severity !== 'advisory') ||
    fromWarnings.some((h) => h.type === 'flood' && h.severity !== 'advisory');
  const hazards = [...fromWarnings, ...fromStations.map((m) => m.hazard)].sort(
    (a, b) => a.distanceAlongRouteKm - b.distanceAlongRouteKm || severityRank(b.severity) - severityRank(a.severity),
  );
  return { hazards, floodOnRoute };
}

export function severityRank(s: HazardSeverity): number {
  return s === 'danger' ? 2 : s === 'warning' ? 1 : 0;
}

/** Optional fake data for ?demo=flood (see demoHazards.ts). */
export type DemoData = { warnings: MetWarning[]; stations: FloodStation[] };

export type RouteHazardReport = HazardReport & { floodOnRoute: boolean };

/**
 * Fetches official data and matches it to one route. Returns null if no official data could be
 * loaded (the UI then simply shows nothing). Never throws.
 */
export async function checkRouteHazards(
  coords: LngLat[],
  etaSeconds: number,
  options: { now?: number; demo?: DemoData | null } = {},
): Promise<RouteHazardReport | null> {
  try {
    const now = options.now ?? Date.now();
    const line = measureLine(coords);
    const districts = await loadDistricts();
    const samples = sampleRoute(line, districts);
    const states = [...new Set(samples.map((s) => s.district?.state).filter((s): s is string => !!s))];
    const [warnings, ...perState] = await Promise.all([fetchWarnings(), ...states.map((s) => fetchFloodStations(floodApiState(s)))]);
    const stations = perState.flatMap((s) => s ?? []);
    const demo = options.demo;
    if (warnings === null && perState.every((s) => s === null) && !demo) return null;
    const notes: string[] = [];
    const newest = stations.reduce<string | null>((m, s) => (s.updatedAt && (!m || s.updatedAt > m) ? s.updatedAt : m), null);
    if (stations.length && newest && !isFresh(newest, now)) {
      notes.push(`JPS river data out of date (${formatMyDate(newest)}) – not used.`);
    } else if (states.length && perState.every((s) => s === null)) {
      notes.push('JPS river data unavailable.');
    }
    if (warnings === null) notes.push('MET warnings unavailable.');
    const result = buildHazards({
      line,
      samples,
      warnings: [...(warnings ?? []), ...(demo?.warnings ?? [])],
      stations: [...stations, ...(demo?.stations ?? [])],
      now,
      etaSeconds,
    });
    return { ...result, checkedAt: now, notes };
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Terus hazards] check failed', err);
    return null;
  }
}

export function formatMyDate(iso: string): string {
  return new Intl.DateTimeFormat('en-MY', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(iso));
}

/** Today's date in Malaysia as YYYY-MM-DD. */
export function myToday(now = Date.now()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kuala_Lumpur' }).format(new Date(now));
}

/** Picks the best forecast row for a district: district (Ds) > town (Tn) > state (St), today's date. */
export function pickForecast(rows: ForecastDay[], districtName: string, today: string): ForecastDay | null {
  const todays = rows.filter((r) => r.date === today && sameArea(r.locationName, districtName));
  const rank = (id: string) => (id.startsWith('Ds') ? 0 : id.startsWith('Tn') ? 1 : 2);
  return todays.sort((a, b) => rank(a.locationId) - rank(b.locationId))[0] ?? null;
}

/** Today's official forecast for the destination's district (null if unavailable). */
export async function destinationForecast(dest: LngLat, now = Date.now()): Promise<DestinationForecast | null> {
  try {
    const d = districtAt(dest, await loadDistricts());
    if (!d) return null;
    const name = d.name.replace(/^W\.P\.\s*/, '');
    const rows = await fetchForecast(name);
    const row = rows && pickForecast(rows, name, myToday(now));
    if (!row) return null;
    return {
      locationName: row.locationName,
      date: row.date,
      morning: row.morning,
      afternoon: row.afternoon,
      night: row.night,
      summary: row.summary,
      summaryWhen: row.summaryWhen,
      minTemp: row.minTemp,
      maxTemp: row.maxTemp,
    };
  } catch {
    return null;
  }
}

/**
 * Points for Mapbox's `exclude=point(lng lat)` so a new route avoids flood warning / danger areas:
 * each station's spot on the route, plus points 300 m either side of it. Max 50 (Mapbox's limit).
 */
export function floodAvoidPoints(hazards: RouteHazard[], line: MeasuredLine): LngLat[] {
  const pts: LngLat[] = [];
  for (const h of hazards) {
    if (h.type !== 'flood' || h.severity === 'advisory') continue;
    const centreKm = h.location ? snapToLine(line, h.location).along / 1000 : (h.segment.startKm + h.segment.endKm) / 2;
    for (const dKm of [-0.3, 0, 0.3]) {
      const km = centreKm + dKm;
      if (km > 0.2 && km < line.length / 1000 - 0.2) pts.push(pointAlong(line, km * 1000));
    }
  }
  return pts.slice(0, 50);
}
