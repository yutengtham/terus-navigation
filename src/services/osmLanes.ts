import type { LngLat } from '../config/malaysia';
import { bearingDegrees, measureLine, pointAlong, snapToLine, type MeasuredLine } from '../utils/geo';
import type { LaneSample } from './laneRibbon';

/*
 * Lane counts from OpenStreetMap ("lanes", "lanes:forward" tags) for the roads along a route,
 * via the free public Overpass API. Best-effort: one request per route, cached, 12 s timeout
 * per server; on any failure the lane view simply uses Mapbox data and road-class defaults.
 */

const OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const cache = new Map<string, Promise<LaneSample[]>>();

type OsmWay = { tags?: Record<string, string>; geometry?: { lat: number; lon: number }[] };

/** Lanes in OUR direction of travel for a way (or null if the tags don't say). */
export function lanesForDirection(tags: Record<string, string>, forward: boolean): number | null {
  const n = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
  const oneway = tags.oneway === 'yes' || tags.oneway === '1' || /^motorway/.test(tags.highway ?? '');
  if (oneway) return n(tags.lanes);
  const dirTag = forward ? n(tags['lanes:forward']) : n(tags['lanes:backward']);
  if (dirTag) return dirTag;
  const total = n(tags.lanes);
  return total ? Math.max(1, Math.floor(total / 2)) : null;
}

/** Route key: same geometry (start, end, length) -> same cached result, even after a reroute back. */
function routeKey(line: MeasuredLine): string {
  const a = line.coords[0];
  const b = line.coords[line.coords.length - 1];
  return [a[0].toFixed(4), a[1].toFixed(4), b[0].toFixed(4), b[1].toFixed(4), Math.round(line.length / 50)].join(',');
}

async function overpass(query: string): Promise<OsmWay[]> {
  for (const url of OVERPASS_SERVERS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(12000) });
      if (!r.ok) continue;
      const json = (await r.json()) as { elements?: OsmWay[] };
      return json.elements ?? [];
    } catch {
      /* try the next server */
    }
  }
  return [];
}

/** Every ~50 m along the route: the OSM lane count of the matching road, if tagged. */
export function fetchOsmLaneSamples(line: MeasuredLine): Promise<LaneSample[]> {
  const key = routeKey(line);
  const hit = cache.get(key);
  if (hit) return hit;
  const job = (async (): Promise<LaneSample[]> => {
    // A thinned copy of the route (every ~150 m) for the "around" filter.
    const pts: LngLat[] = [];
    for (let a = 0; a <= line.length; a += 150) pts.push(pointAlong(line, a));
    pts.push(line.coords[line.coords.length - 1]);
    const around = pts.map(([lng, lat]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
    const query = `[out:json][timeout:12];way(around:20,${around})["highway"~"^(motorway|trunk|primary|secondary|tertiary)(_link)?$"]["lanes"];out tags geom;`;
    const ways = await overpass(query);
    const samples: LaneSample[] = [];
    const wayLines = ways
      .filter((w) => w.tags && w.geometry && w.geometry.length > 1)
      .map((w) => ({ tags: w.tags!, line: measureLine(w.geometry!.map((g) => [g.lon, g.lat] as LngLat)) }));
    for (let a = 0; a <= line.length; a += 50) {
      const p = pointAlong(line, a);
      const heading = bearingDegrees(pointAlong(line, Math.max(0, a - 10)), pointAlong(line, Math.min(line.length, a + 10)));
      let best: { count: number; dist: number } | null = null;
      for (const w of wayLines) {
        const s = snapToLine(w.line, p);
        if (s.offset > 12 || (best && s.offset >= best.dist)) continue;
        const wb = bearingDegrees(pointAlong(w.line, Math.max(0, s.along - 5)), pointAlong(w.line, Math.min(w.line.length, s.along + 5)));
        const diff = Math.abs(((wb - heading + 540) % 360) - 180);
        if (diff > 35 && diff < 145) continue; // a crossing road, not ours
        const count = lanesForDirection(w.tags, diff <= 35);
        if (count) best = { count: Math.min(6, count), dist: s.offset };
      }
      if (best) samples.push({ along: a, count: best.count, source: 'osm' });
    }
    return samples;
  })();
  cache.set(key, job);
  return job;
}
