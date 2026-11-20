import { useEffect, useRef } from 'react';
import { computeProgress, type PreparedRoute } from '../services/routeProgress';
import { maybeJoke } from '../services/voiceJokes';
import { lanesAreInformative } from '../services/laneGuidance';
import { distanceToNextInstruction } from './useVoiceGuidance';

/** Index of the line segment that contains `along` metres. */
function segmentAt(cumulative: number[], along: number): number {
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= along) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Metres of heavy / severe traffic between `from` and `to` along the route. */
export function jamMetres(cumulative: number[], congestion: string[], from: number, to: number): number {
  let total = 0;
  for (let i = segmentAt(cumulative, from); i < congestion.length && cumulative[i] < to; i++) {
    if (congestion[i] === 'heavy' || congestion[i] === 'severe') {
      total += Math.min(to, cumulative[i + 1] ?? to) - Math.max(from, cumulative[i]);
    }
  }
  return Math.max(0, total);
}

/**
 * Personality lines for things that aren't Mapbox instructions: toll ahead (after the toll
 * reminder), traffic jam ahead, speeding, and long straight roads. Every one goes through the
 * same safety rules (maybeJoke), so nothing is said near a maneuver or close to an instruction.
 */
export function usePersonalityEvents(
  prepared: PreparedRoute | null,
  traveled: number | null,
  speedKmh: number,
  tollNear: boolean,
  voiceOn: boolean,
): void {
  const done = useRef(new Set<string>());
  const overSince = useRef<number | null>(null);
  useEffect(() => {
    done.current = new Set();
  }, [prepared]);

  useEffect(() => {
    if (!prepared || traveled === null) return;
    const route = prepared.route;
    const { stepIndex, distanceToManeuver } = computeProgress(prepared, traveled);
    const base = {
      toManeuverM: distanceToManeuver,
      toNextInstructionM: distanceToNextInstruction(prepared, traveled),
      complex: lanesAreInformative(route.steps[stepIndex]?.lanes),
    };
    const once = (key: string, event: Parameters<typeof maybeJoke>[0]['event']) => {
      if (done.current.has(key)) return;
      if (maybeJoke({ ...base, event }, voiceOn)) done.current.add(key);
    };

    // Toll reminder just spoken (1 km before the plaza) -> maybe a toll line after it.
    if (tollNear) once(`toll@${stepIndex}`, 'toll_ahead');

    // Heavy traffic in the next 1.5 km (Mapbox traffic data), at most once per 3 km.
    const cum = prepared.line.cumulative;
    if (route.congestion?.length && jamMetres(cum, route.congestion, traveled, traveled + 1500) >= 300) {
      once(`jam@${Math.floor(traveled / 3000)}`, 'traffic_jam');
    }

    // Over the posted limit (+5 km/h) for 4 seconds.
    const seg = segmentAt(cum, traveled);
    const limit = route.maxspeedKmh?.[seg] ?? null;
    if (limit && speedKmh > limit + 5) {
      overSince.current ??= Date.now();
      if (Date.now() - overSince.current > 4000) once(`speed@${Math.floor(traveled / 2000)}`, 'speeding');
    } else overSince.current = null;

    // A long straight stretch (step over 3 km, well inside it).
    const step = route.steps[stepIndex];
    const stepStart = stepIndex === 0 ? 0 : prepared.stepEnds[stepIndex - 1];
    if (step && step.distance > 3000 && traveled - stepStart > 800 && distanceToManeuver > 1500) once(`straight@${stepIndex}`, 'long_straight');
  }, [prepared, traveled, speedKmh, tollNear, voiceOn]);
}
