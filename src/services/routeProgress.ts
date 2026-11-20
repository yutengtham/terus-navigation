import type { Maneuver, NavRoute } from '../models/route';
import { measureLine, type MeasuredLine } from '../utils/geo';

/** A route plus the pre-computed numbers we need many times per second. */
export type PreparedRoute = {
  route: NavRoute;
  line: MeasuredLine;
  /** Distance along the line where each step ends. */
  stepEnds: number[];
};

export function prepareRoute(route: NavRoute): PreparedRoute {
  const line = measureLine(route.coordinates);
  const apiTotal = route.steps.reduce((sum, s) => sum + s.distance, 0) || 1;
  const scale = line.length / apiTotal; // line length and API step lengths differ slightly
  let running = 0;
  const stepEnds = route.steps.map((s) => (running += s.distance * scale));
  return { route, line, stepEnds };
}

export type RouteProgress = {
  /** Index of the step being driven now */
  stepIndex: number;
  remainingDistance: number;
  remainingDuration: number;
  nextManeuver: Maneuver | null;
  distanceToManeuver: number;
};

/** Where are we on the route after travelling `traveled` metres? */
export function computeProgress(p: PreparedRoute, traveled: number): RouteProgress {
  const { route, line, stepEnds } = p;
  let i = stepEnds.findIndex((end) => end > traveled);
  if (i === -1) i = stepEnds.length - 1;

  const remainingDistance = Math.max(0, line.length - traveled);
  return {
    stepIndex: i,
    remainingDistance,
    remainingDuration: line.length ? route.duration * (remainingDistance / line.length) : 0,
    // While driving along step i, the next thing to do is step i+1's maneuver.
    nextManeuver: route.steps[i + 1]?.maneuver ?? route.steps[i]?.maneuver ?? null,
    distanceToManeuver: Math.max(0, stepEnds[i] - traveled),
  };
}
