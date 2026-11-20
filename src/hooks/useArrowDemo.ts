import { useEffect, useRef, useState } from 'react';
import type { TravelMode } from '../models/route';
import type { GpsFix } from '../services/locationService';
import { bearingAlong, pointAlong, type MeasuredLine } from '../utils/geo';

/*
 * DEMO MODE ONLY - a pretend person (or car) moves along a real route and a pretend compass
 * turns with them, so Arrow Mode can be presented reliably indoors (e.g. at a hackathon).
 *
 * The script shows every state of the arrow:
 *   0-3 s     phone pointing 80° off to the left  -> amber arrow, "Turn right" cue
 *   then      walks the route, small natural wobble  -> green
 *   at 40%    stops and looks back the wrong way     -> red "Turn around"
 *   end       arrives                                 -> "You have arrived"
 *
 * Time runs faster than real life (walking x3, driving x2) so a demo takes ~2 minutes.
 */

const SPEED: Record<TravelMode, { kmh: number; warp: number }> = {
  walking: { kmh: 5, warp: 3 },
  cycling: { kmh: 15, warp: 2 },
  driving: { kmh: 35, warp: 2 }, // > 15 km/h: shows the simplified driving view
};

export type DemoState = { fix: GpsFix | null; heading: number | null };

export function useArrowDemo(line: MeasuredLine | null, active: boolean, mode: TravelMode, paused: boolean): DemoState {
  const [state, setState] = useState<DemoState>({ fix: null, heading: null });
  const pausedRef = useRef(paused);
  useEffect(() => {
    pausedRef.current = paused; // the Pause button freezes the pretend walker too
  }, [paused]);

  useEffect(() => {
    if (!active || !line) return;
    const { kmh, warp } = SPEED[mode];
    const mps = (kmh / 3.6) * warp;
    const lookBackAt = line.length * 0.4;
    let traveled = 0;
    let elapsed = 0; // demo seconds
    let lookBackStart: number | null = null;
    let last = performance.now();
    let lastFixAt = -1;
    let heading = (bearingAlong(line, 0) - 80 + 360) % 360;

    const timer = window.setInterval(() => {
      if (pausedRef.current) {
        last = performance.now();
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.2, (now - last) / 1000);
      last = now;
      elapsed += dt;

      const routeBearing = bearingAlong(line, traveled);
      let wanted = routeBearing + 8 * Math.sin(elapsed * 1.3); // natural hand wobble
      let moving = true;
      if (elapsed < 3) {
        wanted = routeBearing - 80; // start: facing the wrong way
        moving = false;
      } else if (traveled >= lookBackAt && lookBackStart === null) {
        lookBackStart = elapsed;
      }
      if (lookBackStart !== null && elapsed - lookBackStart < 6) {
        wanted = routeBearing + 175; // stop and face backwards for a few seconds
        moving = false;
      }
      if (moving) traveled = Math.min(line.length, traveled + mps * dt);

      // Turn the pretend phone smoothly towards where the person faces.
      const diff = ((wanted - heading + 540) % 360) - 180;
      heading = (heading + diff * Math.min(1, dt * 2.5) + 360) % 360;

      // A GPS reading about once per (real) second, like a phone.
      let fix: GpsFix | undefined;
      if (now - lastFixAt > 1000 || lastFixAt < 0) {
        lastFixAt = now;
        fix = {
          position: pointAlong(line, traveled),
          accuracy: 6,
          speedKmh: moving ? kmh : 0,
          heading: moving ? routeBearing : null,
          timestamp: Date.now(),
        };
      }
      setState((s) => ({ fix: fix ?? s.fix, heading }));
    }, 50);
    return () => window.clearInterval(timer);
  }, [active, line, mode]);

  return state;
}
