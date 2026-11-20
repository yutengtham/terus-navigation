import { useEffect, useMemo, useState } from 'react';
import { HAZARD_REFRESH_MIN } from '../config/hazardSources';
import type { LngLat } from '../config/malaysia';
import { demoHazardData } from '../services/demoHazards';
import { checkRouteHazards, type RouteHazardReport } from '../services/routeHazards';

export type HazardRouteInput = { coordinates: LngLat[]; duration: number };

/**
 * Official alerts for each given route (same order). null entries = not checked / unavailable.
 * Re-checks when the routes change (new search, reroute) and every 10 minutes.
 * Network answers are cached and shared, so checking several routes costs the same requests.
 */
export function useRouteHazards(routes: HazardRouteInput[], enabled: boolean, demo: boolean): (RouteHazardReport | null)[] {
  const [reports, setReports] = useState<(RouteHazardReport | null)[]>([]);
  const [tick, setTick] = useState(0);
  // Identity of the route set: start, end, length of each route.
  const key = useMemo(
    () => routes.map((r) => `${r.coordinates[0]?.join()}>${r.coordinates[r.coordinates.length - 1]?.join()}#${r.coordinates.length}`).join('|'),
    [routes],
  );

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => setTick((t) => t + 1), HAZARD_REFRESH_MIN * 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  useEffect(() => {
    setReports([]);
    if (!enabled || !routes.length) return;
    let alive = true;
    void (async () => {
      const demoData = demo ? await demoHazardData(routes[0].coordinates) : null;
      const out = await Promise.all(routes.map((r) => checkRouteHazards(r.coordinates, r.duration, { demo: demoData })));
      if (alive) setReports(out);
    })();
    return () => {
      alive = false;
    };
    // `key` stands in for `routes` (a new array each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, demo, tick]);

  return enabled ? reports : [];
}
