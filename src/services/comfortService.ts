import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader } from 'pbf';
import { getPosition } from 'suncalc';
import type { LngLat } from '../config/malaysia';
import type { NavRoute } from '../models/route';
import { measureLine, pointAlong } from '../utils/geo';

/*
 * Shade & shelter scores for walking / cycling routes (idea from Singapore's Undercover app).
 *
 *  - SHADE: where the sun is (SunCalc) at the time you walk, and whether a building stands
 *    between you and the sun, using building footprints + heights from Mapbox's own map data
 *    (the same buildings drawn on the 3D map). Trees are NOT counted - there is no reliable
 *    tree-canopy data for Malaysia - so real shade is usually a bit better than shown.
 *  - SHELTER: parts of the route inside a building, through a pedestrian tunnel / underpass
 *    (Mapbox data), or along a covered walkway / arcade / roof mapped in OpenStreetMap.
 *
 * Both are estimates from map data. Nothing here affects turn-by-turn directions.
 */

export type ComfortScore = {
  /** 0..1 share of the route in shade; null when the sun is down (shade doesn't matter). */
  shade: number | null;
  /** 0..1 share of the route under a roof (rain cover). */
  shelter: number;
};

type Ring = [number, number][]; // local metres
type Building = { rings: Ring[]; height: number; minHeight: number; box: [number, number, number, number] };
type Shelter = { kind: 'line'; pts: Ring } | { kind: 'area'; rings: Ring[] };

export type ComfortData = {
  origin: LngLat;
  buildings: Building[];
  shelters: Shelter[];
  grid: Map<string, number[]>;
  maxHeight: number;
  /** false when the OpenStreetMap covered-walkway lookup failed (shelter may be under-counted) */
  coveredWalkwaysLoaded: boolean;
};

// ---------- local flat coordinates (metres) - accurate enough within a few km ----------
const M_PER_DEG_LAT = 110574;
function toLocal(origin: LngLat, p: LngLat): [number, number] {
  return [(p[0] - origin[0]) * 111320 * Math.cos((origin[1] * Math.PI) / 180), (p[1] - origin[1]) * M_PER_DEG_LAT];
}

// ---------- Mapbox vector tiles (Mapbox Streets v8: "building" and "road" layers) ----------
const TILE_ZOOM = 15; // ~1.2 km per tile in Malaysia; buildings are complete at this zoom
const tileCache = new Map<string, Promise<VectorTile | null>>();

function lngLatToTile(p: LngLat, z: number): [number, number] {
  const n = 2 ** z;
  const lat = (p[1] * Math.PI) / 180;
  return [
    Math.floor(((p[0] + 180) / 360) * n),
    Math.floor(((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n),
  ];
}
function tilePointToLngLat(x: number, y: number, z: number, px: number, py: number, extent: number): LngLat {
  const n = 2 ** z;
  const lng = ((x + px / extent) / n) * 360 - 180;
  const yy = Math.PI * (1 - (2 * (y + py / extent)) / n);
  return [lng, (Math.atan(Math.sinh(yy)) * 180) / Math.PI];
}

function loadTile(token: string, x: number, y: number): Promise<VectorTile | null> {
  const key = `${x}/${y}`;
  let p = tileCache.get(key);
  if (!p) {
    // Each new tile = 1 Vector Tiles API request (200,000 free per month). Cached for the session.
    p = fetch(`https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/${TILE_ZOOM}/${x}/${y}.vector.pbf?access_token=${token}`)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((buf) => new VectorTile(new PbfReader(new Uint8Array(buf))))
      .catch(() => {
        tileCache.delete(key); // try again next time
        return null;
      });
    tileCache.set(key, p);
  }
  return p;
}

// ---------- OpenStreetMap covered walkways (Overpass API, free public services) ----------
/**
 * Public Overpass servers, tried in order: the main FOSSGIS server answers or refuses quickly;
 * Private.coffee (free for any project, no rate limit) is the backup. Both can be overloaded -
 * then shelter is counted from Mapbox data only (buildings + underpasses) and the app says so.
 * See https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances
 */
const OVERPASS_SERVERS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];

async function fetchOverpass(query: string): Promise<Response> {
  let last: unknown = new Error('no server');
  for (const url of OVERPASS_SERVERS) {
    try {
      const r = await fetch(url, { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(12000) });
      if (r.ok) return r;
      last = new Error(String(r.status)); // busy (429 / 502 / 504) -> try the next server
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

const overpassCache = new Map<string, Promise<LngLat[][] | null>>();

/** Covered footways, arcades, colonnades, corridors, pedestrian underpasses and roofs/canopies. */
function loadCoveredWays(box: [number, number, number, number]): Promise<LngLat[][] | null> {
  const [w, s, e, n] = box.map((v) => Math.round(v * 500) / 500); // snap so nearby trips share a cache entry
  const key = [w, s, e, n].join(',');
  let p = overpassCache.get(key);
  if (!p) {
    const bb = `${s - 0.002},${w - 0.002},${n + 0.002},${e + 0.002}`;
    const query = `[out:json][timeout:12];(
      way["highway"]["covered"~"^(yes|arcade|colonnade|roof)$"](${bb});
      way["highway"="corridor"](${bb});
      way["highway"~"^(footway|path|pedestrian|steps|cycleway)$"]["tunnel"~"^(yes|building_passage)$"](${bb});
      way["building"="roof"](${bb});
      way["amenity"="shelter"](${bb});
    );out geom;`;
    p = fetchOverpass(query)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { elements?: { geometry?: { lon: number; lat: number }[] }[] }) =>
        (json.elements ?? []).filter((el) => el.geometry?.length).map((el) => el.geometry!.map((g) => [g.lon, g.lat] as LngLat)),
      )
      .catch(() => {
        overpassCache.delete(key);
        return null;
      });
    overpassCache.set(key, p);
  }
  return p;
}

// ---------- build the data for an area ----------
const GRID = 25; // metres per index cell
const cellKey = (cx: number, cy: number) => `${cx},${cy}`;

function routesBox(routes: NavRoute[]): [number, number, number, number] {
  let w = Infinity,
    s = Infinity,
    e = -Infinity,
    n = -Infinity;
  for (const r of routes)
    for (const [x, y] of r.coordinates) {
      w = Math.min(w, x);
      s = Math.min(s, y);
      e = Math.max(e, x);
      n = Math.max(n, y);
    }
  return [w, s, e, n];
}

/**
 * Loads buildings (fast, Mapbox) and - when `withCoveredWalkways` - covered walkways from
 * OpenStreetMap (can take several seconds on the free public server).
 */
export async function loadComfortData(token: string, routes: NavRoute[], withCoveredWalkways = true): Promise<ComfortData> {
  const [w, s, e, n] = routesBox(routes);
  const pad = 0.0025; // ~250 m: tall buildings just off the route still cast shade onto it
  const [x0, y0] = lngLatToTile([w - pad, n + pad], TILE_ZOOM);
  const [x1, y1] = lngLatToTile([e + pad, s - pad], TILE_ZOOM);
  const jobs: Promise<[number, number, VectorTile | null]>[] = [];
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) jobs.push(loadTile(token, x, y).then((t) => [x, y, t]));
  const [tiles, covered] = await Promise.all([Promise.all(jobs), withCoveredWalkways ? loadCoveredWays([w, s, e, n]) : null]);

  const origin: LngLat = [(w + e) / 2, (s + n) / 2];
  const buildings: Building[] = [];
  const shelters: Shelter[] = [];
  const seen = new Set<string>(); // buildings crossing tile edges appear in both tiles

  for (const [x, y, tile] of tiles) {
    if (!tile) continue;
    const bl = tile.layers.building;
    for (let i = 0; bl && i < bl.length; i++) {
      const f = bl.feature(i);
      if (f.type !== 3 || f.properties.underground === 'true') continue;
      const rings = f
        .loadGeometry()
        .map((ring) => ring.map((pt) => toLocal(origin, tilePointToLngLat(x, y, TILE_ZOOM, pt.x, pt.y, bl.extent))));
      // Mapbox gives "height" (metres) for most buildings; a few have none -> assume one storey.
      const height = Number(f.properties.height) || 3;
      const minHeight = Number(f.properties.min_height) || 0;
      let bx0 = Infinity,
        by0 = Infinity,
        bx1 = -Infinity,
        by1 = -Infinity;
      for (const r of rings)
        for (const [px, py] of r) {
          bx0 = Math.min(bx0, px);
          by0 = Math.min(by0, py);
          bx1 = Math.max(bx1, px);
          by1 = Math.max(by1, py);
        }
      const id = `${f.id ?? ''}:${Math.round(bx0)}:${Math.round(by0)}:${Math.round(bx1)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      buildings.push({ rings, height, minHeight, box: [bx0, by0, bx1, by1] });
    }
    // Pedestrian / cycle tunnels and underpasses count as sheltered.
    const rl = tile.layers.road;
    for (let i = 0; rl && i < rl.length; i++) {
      const f = rl.feature(i);
      if (f.type !== 2 || f.properties.structure !== 'tunnel') continue;
      if (!['path', 'pedestrian', 'service'].includes(String(f.properties.class))) continue;
      for (const line of f.loadGeometry())
        shelters.push({
          kind: 'line',
          pts: line.map((pt) => toLocal(origin, tilePointToLngLat(x, y, TILE_ZOOM, pt.x, pt.y, rl.extent))),
        });
    }
  }
  for (const way of covered ?? []) {
    const pts = way.map((p) => toLocal(origin, p));
    const closed = way.length > 3 && way[0][0] === way[way.length - 1][0] && way[0][1] === way[way.length - 1][1];
    shelters.push(closed ? { kind: 'area', rings: [pts] } : { kind: 'line', pts });
  }

  const grid = new Map<string, number[]>();
  let maxHeight = 0;
  buildings.forEach((b, idx) => {
    maxHeight = Math.max(maxHeight, b.height);
    for (let cx = Math.floor(b.box[0] / GRID); cx <= Math.floor(b.box[2] / GRID); cx++)
      for (let cy = Math.floor(b.box[1] / GRID); cy <= Math.floor(b.box[3] / GRID); cy++) {
        const k = cellKey(cx, cy);
        const list = grid.get(k);
        if (list) list.push(idx);
        else grid.set(k, [idx]);
      }
  });
  return { origin, buildings, shelters, grid, maxHeight, coveredWalkwaysLoaded: covered !== null };
}

// ---------- geometry helpers ----------
function inRing(px: number, py: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i],
      [xj, yj] = ring[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
/** Even-odd test over all rings handles holes (courtyards) correctly. */
function inRings(px: number, py: number, rings: Ring[]): boolean {
  let inside = false;
  for (const r of rings) if (inRing(px, py, r)) inside = !inside;
  return inside;
}
function distToLine(px: number, py: number, pts: Ring): number {
  let best = Infinity;
  for (let i = 1; i < pts.length; i++) {
    const [ax, ay] = pts[i - 1],
      [bx, by] = pts[i];
    const dx = bx - ax,
      dy = by - ay;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
    best = Math.min(best, Math.hypot(px - ax - t * dx, py - ay - t * dy));
  }
  return best;
}

function buildingAt(data: ComfortData, px: number, py: number, test: (b: Building) => boolean): boolean {
  const list = data.grid.get(cellKey(Math.floor(px / GRID), Math.floor(py / GRID)));
  if (!list) return false;
  for (const idx of list) {
    const b = data.buildings[idx];
    if (px < b.box[0] || px > b.box[2] || py < b.box[1] || py > b.box[3]) continue;
    if (test(b) && inRings(px, py, b.rings)) return true;
  }
  return false;
}

function isSheltered(data: ComfortData, px: number, py: number): boolean {
  if (buildingAt(data, px, py, () => true)) return true; // walking through a building / mall
  for (const s of data.shelters) {
    if (s.kind === 'line' ? distToLine(px, py, s.pts) < 5 : inRings(px, py, s.rings)) return true;
  }
  return false;
}

/** Is a building between this point and the sun? (walks a straight line towards the sun) */
function isInBuildingShadow(data: ComfortData, px: number, py: number, azimuthDeg: number, altitudeDeg: number): boolean {
  const tanAlt = Math.tan((altitudeDeg * Math.PI) / 180);
  const reach = Math.min(300, data.maxHeight / tanAlt); // further away nothing is tall enough
  const dx = Math.sin((azimuthDeg * Math.PI) / 180);
  const dy = Math.cos((azimuthDeg * Math.PI) / 180);
  for (let d = 2; d <= reach; d += 3) {
    const rayHeight = d * tanAlt; // height of the sun ray above the ground at this distance
    if (buildingAt(data, px + dx * d, py + dy * d, (b) => b.height > rayHeight && b.minHeight < rayHeight)) return true;
  }
  return false;
}

/** Below this sun height shade doesn't matter (dawn, dusk and night). */
const LOW_SUN_DEG = 6;
const SAMPLE_EVERY_M = 8;

/** Scores one route for a trip that starts at `departure`. */
export function scoreRoute(route: NavRoute, data: ComfortData, departure: Date): ComfortScore {
  const line = measureLine(route.coordinates);
  const n = Math.max(2, Math.ceil(line.length / SAMPLE_EVERY_M));
  let shaded = 0,
    sheltered = 0,
    sunUpSamples = 0;
  for (let i = 0; i < n; i++) {
    const along = ((i + 0.5) / n) * line.length;
    const p = pointAlong(line, along);
    const [px, py] = toLocal(data.origin, p);
    const covered = isSheltered(data, px, py);
    if (covered) sheltered++;
    // Sun position for the moment you reach this point (long walks see the sun move).
    const when = new Date(departure.getTime() + (along / line.length) * route.duration * 1000);
    const sun = getPosition(when, p[1], p[0]);
    if (sun.altitude < LOW_SUN_DEG) continue;
    sunUpSamples++;
    if (covered || isInBuildingShadow(data, px, py, sun.azimuth, sun.altitude)) shaded++;
  }
  return { shade: sunUpSamples > n / 2 ? shaded / sunUpSamples : null, shelter: sheltered / n };
}

/** Is the sun high enough to matter at this time in KL? */
export function isSunUp(date: Date, at: LngLat): boolean {
  return getPosition(date, at[1], at[0]).altitude >= LOW_SUN_DEG;
}

export type ComfortPreference = 'fastest' | 'shade' | 'shelter';

/**
 * "Recommended" balance, like Undercover: a slightly longer route wins if it is clearly more
 * comfortable. cost = time x (1 + weight x share in sun/rain). E.g. with the shade weight 0.6,
 * a route 10% longer wins if it has at least ~17 percentage points more shade.
 */
export function comfortCost(route: NavRoute, score: ComfortScore | undefined, pref: ComfortPreference): number {
  if (pref === 'fastest' || !score) return route.duration;
  // After dark shade doesn't matter, so "Shaded" falls back to ranking by shelter.
  if (pref === 'shade' && score.shade !== null) return route.duration * (1 + 0.6 * (1 - score.shade));
  return route.duration * (1 + 0.9 * (1 - score.shelter));
}
