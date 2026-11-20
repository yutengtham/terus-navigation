import type { LngLat } from '../config/malaysia';
import { distanceMeters, measureLine, pointAlong, snapToLine } from '../utils/geo';
import { estimateTolls } from './tollEstimate';
import { lanesForManeuver, lanesFromIntersection, type ApiBanner, type ApiIntersectionLane } from './laneGuidance';
import type { LaneJunction, NavRoute, RouteStep, TollPlaza, TravelMode } from '../models/route';

/** An error with a plain-English message we can show to the user. */
export class DirectionsError extends Error {
  constructor(
    message: string,
    /** 'no-route-with-avoid' = a route exists, just not while avoiding tolls / highways / ferries */
    readonly reason: 'no-route' | 'no-route-with-avoid' | 'other' = 'other',
  ) {
    super(message);
  }
}

type ApiStep = {
  distance: number;
  duration: number;
  name: string;
  ref?: string;
  maneuver: { type: string; modifier?: string; exit?: number; instruction: string; location: LngLat };
  intersections?: {
    classes?: string[];
    location: LngLat;
    toll_collection?: { type: string; name?: string };
    lanes?: ApiIntersectionLane[];
  }[];
  voiceInstructions?: { distanceAlongGeometry: number; announcement: string }[];
  bannerInstructions?: ApiBanner[];
};
type ApiRoute = {
  distance: number;
  duration: number;
  geometry: { coordinates: LngLat[] };
  legs: {
    summary?: string;
    steps: ApiStep[];
    annotation?: { congestion?: string[]; maxspeed?: { speed?: number; unit?: string; unknown?: boolean; none?: boolean }[] };
  }[];
};
/** The parts of a Mapbox Directions response Terus reads (exported for the dev checks). */
export type ApiResponse = { code: string; message?: string; routes?: ApiRoute[] };

export type RouteOptions = {
  /** driving (default), walking or cycling */
  mode?: TravelMode;
  avoidTolls?: boolean;
  avoidHighways?: boolean;
  avoidFerries?: boolean;
  /** Units for the spoken instructions */
  units?: 'metric' | 'imperial';
  /** Ask for up to 2 extra route choices (Mapbox decides if good ones exist). */
  alternatives?: boolean;
  /** Pass through this point (silently - no "you have arrived" there). Used for detour choices. */
  via?: LngLat;
  /**
   * Driving only: road spots to keep off (Mapbox `exclude=point(lng lat)`, beta, max 50, best effort).
   * Used by "Avoid flood areas" with official flood alert locations.
   */
  excludePoints?: LngLat[];
  signal?: AbortSignal;
};

/** Turns a Directions response into Terus routes (used by the dev check page with a saved sample). */
export function routesFromResponse(data: ApiResponse): NavRoute[] {
  return (data.routes ?? []).map(toNavRoute);
}

function toNavRoute(route: ApiRoute): NavRoute {
  const apiSteps = route.legs.flatMap((leg) => leg.steps);
  const steps: RouteStep[] = apiSteps.map((s, i) => ({
    distance: s.distance,
    duration: s.duration,
    name: s.name,
    ref: s.ref || null,
    maneuver: { ...s.maneuver },
    voice: (s.voiceInstructions ?? []).map((v) => ({ distanceBeforeEnd: v.distanceAlongGeometry, text: v.announcement })),
    towards: s.bannerInstructions?.[0]?.primary?.text || null,
    // Lanes for the junction at the end of this step (banner lanes, else the junction's own lanes).
    lanes: lanesForManeuver(s.bannerInstructions, apiSteps[i + 1]?.intersections?.[0]?.lanes),
    highway:
      /^E\d/.test(s.ref ?? '') || (s.intersections ?? []).some((x) => x.classes?.includes('motorway')),
  }));
  return {
    coordinates: route.geometry.coordinates,
    distance: route.distance,
    duration: route.duration,
    steps,
    summary: route.legs
      .map((l) => l.summary)
      .filter(Boolean)
      .join(', '),
    // Mapbox tags each road crossing with classes such as "toll", "motorway", "tunnel".
    hasTolls: apiSteps.some((s) => s.intersections?.some((i) => i.classes?.includes('toll') || i.toll_collection)),
    ...annotationsOf(route),
    laneJunctions: apiSteps.flatMap((s) =>
      (s.intersections ?? []).flatMap((x): LaneJunction[] => {
        const lanes = lanesFromIntersection(x.lanes);
        return lanes ? [{ location: x.location, lanes }] : [];
      }),
    ),
    // Each toll booth / gantry Mapbox knows on the route, with the road's route number(s).
    tollPlazas: apiSteps.flatMap((s) =>
      (s.intersections ?? [])
        .filter((i) => i.toll_collection)
        .map(
          (i): TollPlaza => ({
            name: i.toll_collection?.name ?? '',
            refs: (s.ref ?? '').split(';').map((r) => r.trim()).filter(Boolean),
            location: i.location,
          }),
        ),
    ),
  };
}

/** Traffic + speed limits per segment (driving), joined across legs. Missing data -> fields left out. */
function annotationsOf(route: ApiRoute): Pick<NavRoute, 'congestion' | 'maxspeedKmh'> {
  const legs = route.legs.map((l) => l.annotation);
  if (!legs.every((a) => a?.congestion && a.maxspeed)) return {};
  return {
    congestion: legs.flatMap((a) => a?.congestion ?? []),
    maxspeedKmh: legs.flatMap((a) =>
      (a?.maxspeed ?? []).map((m) => (typeof m.speed === 'number' ? (m.unit === 'mph' ? Math.round(m.speed * 1.609) : m.speed) : null)),
    ),
  };
}

/** Mapbox routing profile for each travel mode. */
const PROFILES: Record<TravelMode, string> = {
  driving: 'driving-traffic', // live / typical traffic where available
  walking: 'walking',
  cycling: 'cycling',
};
const MODE_WORD: Record<TravelMode, string> = { driving: 'driving', walking: 'walking', cycling: 'cycling' };

/**
 * Real routes from the Mapbox Directions API. Driving uses the "driving-traffic" profile
 * (traffic data where available, otherwise typical road speeds); walking and cycling use
 * Mapbox's walking / cycling profiles (footpaths, cycle lanes and quieter streets in map data).
 * Docs: https://docs.mapbox.com/api/navigation/directions/
 * Each call = 1 Directions request (100,000 free per month, shared by all three modes).
 * Returns the recommended route first, then any alternatives.
 */
export async function fetchRoutes(token: string, from: LngLat, to: LngLat, options: RouteOptions = {}): Promise<NavRoute[]> {
  const points = options.via ? [from, options.via, to] : [from, to];
  const coords = points.map((p) => `${p[0]},${p[1]}`).join(';');
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    language: 'en',
    alternatives: options.alternatives && !options.via ? 'true' : 'false',
    voice_instructions: 'true', // ready-made English spoken instructions
    voice_units: options.units ?? 'metric', // metres / kilometres (Malaysia default)
    banner_instructions: 'true', // road names for the instruction card
    access_token: token,
  });
  if (options.via) params.set('waypoints', '0;2'); // the middle point is a "via", not a stop
  const mode = options.mode ?? 'driving';
  const driving = mode === 'driving';
  // Traffic + speed limits along the route (same request, no extra cost): used for the
  // voice personalities' "jam ahead" and "slow down" lines.
  if (driving) params.set('annotations', 'congestion,maxspeed');
  // Walking and cycling routes never use toll roads or motorways; Mapbox only lets them skip ferries.
  const avoidTolls = driving && options.avoidTolls;
  const avoidHighways = driving && options.avoidHighways;
  const exclude = [avoidTolls && 'toll', avoidHighways && 'motorway', options.avoidFerries && 'ferry'].filter(Boolean);
  const avoidPoints = driving ? (options.excludePoints ?? []).slice(0, 50).map((p) => `point(${p[0].toFixed(6)} ${p[1].toFixed(6)})`) : [];
  if (exclude.length || avoidPoints.length) params.set('exclude', [...exclude, ...avoidPoints].join(','));

  let res: Response;
  try {
    res = await fetch(`https://api.mapbox.com/directions/v5/mapbox/${PROFILES[mode]}/${coords}?${params}`, {
      signal: options.signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new DirectionsError('No internet connection. Check your network and try again.');
  }

  const data = (await res.json().catch(() => ({ code: 'Error' }))) as ApiResponse;
  if (!res.ok || data.code !== 'Ok' || !data.routes?.length) {
    if (res.status === 401) throw new DirectionsError('Mapbox rejected the token (401).');
    if (res.status === 403) throw new DirectionsError('This website address is not allowed by your token (403).');
    if (res.status === 429) throw new DirectionsError('Too many route requests. Wait a minute and try again.');
    if ((data.code === 'NoRoute' || data.code === 'NoSegment') && avoidPoints.length && !exclude.length) {
      throw new DirectionsError('No route was found that avoids the current official flood alerts.', 'no-route-with-avoid');
    }
    if (data.code === 'NoRoute' || data.code === 'NoSegment') {
      if (exclude.length) {
        const what = [avoidTolls && 'toll roads', avoidHighways && 'highways', options.avoidFerries && 'ferries']
          .filter(Boolean)
          .join(' and ');
        throw new DirectionsError(`No ${MODE_WORD[mode]} route was found that avoids ${what}.`, 'no-route-with-avoid');
      }
      throw new DirectionsError(`No ${MODE_WORD[mode]} route was found between these places.`, 'no-route');
    }
    throw new DirectionsError(data.message ?? `Route service error (${res.status}). Try again later.`);
  }
  return data.routes.map(toNavRoute);
}

/** Single best route (used where alternatives are not needed). */
export async function fetchDrivingRoute(
  token: string,
  from: LngLat,
  to: LngLat,
  options: Omit<RouteOptions, 'alternatives'> = {},
): Promise<NavRoute> {
  const [best] = await fetchRoutes(token, from, to, { ...options, alternatives: false });
  return best;
}

/** Share of route `a` that runs within 20 m of route `b` (0..1). */
function overlap(a: NavRoute, b: NavRoute): number {
  const la = measureLine(a.coordinates);
  const lb = measureLine(b.coordinates);
  const n = Math.max(4, Math.ceil(la.length / 30));
  let near = 0;
  for (let i = 0; i <= n; i++) if (snapToLine(lb, pointAlong(la, (i / n) * la.length)).offset < 20) near++;
  return near / (n + 1);
}

/**
 * Route choices for walking and cycling, wider than Mapbox's own alternatives: also asks for
 * two detours through a point to the left and right of the middle of the trip, so shade and
 * shelter have real options to choose from. Costs 3 Directions requests instead of 1.
 * Detours more than 40% longer than the shortest choice, or almost identical to another, are dropped.
 */
export async function fetchRouteChoices(
  token: string,
  from: LngLat,
  to: LngLat,
  options: RouteOptions = {},
): Promise<NavRoute[]> {
  const main = await fetchRoutes(token, from, to, { ...options, alternatives: true });
  if ((options.mode ?? 'driving') === 'driving') return main;

  const dist = distanceMeters(from, to);
  const offset = Math.min(400, Math.max(80, dist * 0.15)); // metres to the side
  const mid: LngLat = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2];
  const kx = 111320 * Math.cos((mid[1] * Math.PI) / 180);
  const ky = 110574;
  const vx = (to[0] - from[0]) * kx,
    vy = (to[1] - from[1]) * ky;
  const len = Math.hypot(vx, vy) || 1;
  const vias: LngLat[] = [1, -1].map((side) => [
    mid[0] + (side * -vy * offset) / len / kx,
    mid[1] + (side * vx * offset) / len / ky,
  ]);
  const detours = await Promise.allSettled(vias.map((via) => fetchRoutes(token, from, to, { ...options, via })));

  const all = [...main];
  for (const d of detours) if (d.status === 'fulfilled') all.push(d.value[0]);
  if (options.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const shortest = Math.min(...all.map((r) => r.distance));
  const kept: NavRoute[] = [];
  for (const r of all) {
    if (r.distance > shortest * 1.4) continue;
    if (kept.some((k) => overlap(r, k) > 0.85 && overlap(k, r) > 0.85)) continue;
    kept.push(r);
  }
  return kept;
}

export type CarRouteChoices = {
  routes: NavRoute[];
  /**
   * When tolls / highways are being avoided: the fastest route WITHOUT those limits, if it is
   * clearly faster (so the screen can say "15 min faster with tolls"). Otherwise null.
   */
  fasterWithoutAvoid: NavRoute | null;
};

/** Faster by at least this many seconds before we suggest turning "avoid" off. */
const WORTH_MENTIONING_S = 120;

/**
 * Car routes, making sure the choice is never silently one-sided:
 *  - Not avoiding tolls: Mapbox's up-to-3 routes may all use tolls, so we also ask for its
 *    "avoid tolls" route and add it when it's free or clearly cheaper than everything listed.
 *  - Avoiding tolls / highways: we also ask for the best unrestricted route and report it when
 *    it is clearly faster, so the user knows what they're giving up.
 * Costs 1 extra Directions request per search (100,000 free per month).
 */
export async function fetchCarRouteChoices(
  token: string,
  from: LngLat,
  to: LngLat,
  options: RouteOptions = {},
): Promise<CarRouteChoices> {
  const avoiding = !!(options.avoidTolls || options.avoidHighways);
  const base = { ...options, mode: 'driving' as const };
  const extra = avoiding
    ? fetchRoutes(token, from, to, { ...base, avoidTolls: false, avoidHighways: false, alternatives: false })
    : fetchRoutes(token, from, to, { ...base, avoidTolls: true, alternatives: false });
  // The main request decides success; the extra one is a bonus and may fail quietly.
  const [main, bonus] = await Promise.all([
    fetchRoutes(token, from, to, { ...base, alternatives: true }),
    extra.catch((err: unknown) => {
      if ((err as Error).name === 'AbortError') throw err;
      return [] as NavRoute[];
    }),
  ]);
  const routes = main.slice(0, 3);
  const best = bonus[0];
  if (!best) return { routes, fasterWithoutAvoid: null };

  if (avoiding) {
    const faster = best.duration < routes[0].duration - WORTH_MENTIONING_S;
    return { routes, fasterWithoutAvoid: faster ? best : null };
  }
  // Not avoiding: add Mapbox's "avoid tolls" route if the list has nothing as cheap.
  // (It isn't always 100% free - e.g. near Sunway it still passes the NPE PJS 2 plaza, which
  // charges RM1.00 in one direction - so we compare by our toll estimate and show its price.)
  const cost = (r: NavRoute) => (r.hasTolls ? estimateTolls(r).total + (estimateTolls(r).complete ? 0 : 0.001) : 0);
  const cheapestListed = Math.min(...routes.map(cost));
  const isCopy = routes.some((r) => overlap(best, r) > 0.85 && overlap(r, best) > 0.85);
  const cheaper = !best.hasTolls ? routes.every((r) => r.hasTolls) : cost(best) < cheapestListed - 0.5;
  if (cheaper && !isCopy) routes.push(best);
  return { routes, fasterWithoutAvoid: null };
}
