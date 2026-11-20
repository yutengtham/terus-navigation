import { useEffect, useRef, useState } from 'react';
import type { LngLat } from '../config/malaysia';
import type { TravelMode } from '../models/route';
import { computeProgress, type PreparedRoute } from '../services/routeProgress';
import { bearingDegrees, lerpAngle, pointAlong } from '../utils/geo';

export type DriveFrame = {
  position: LngLat;
  bearing: number;
  traveled: number;
  speedKmh: number;
  finished: boolean;
};

/** Pretend car speed on expressways (km/h). */
const HIGHWAY_KMH = 80;
/** Pretend speeds (km/h) on straight roads and near turns, per travel mode. */
const SPEEDS: Record<TravelMode, { cruise: number; turn: number }> = {
  driving: { cruise: 48, turn: 22 },
  cycling: { cruise: 16, turn: 10 },
  walking: { cruise: 5, turn: 4 },
};

/**
 * SIMULATION ONLY - moves a pretend car along a real route so we can design and
 * test the navigation screen at a desk. Real GPS replaces this in Phase 5.
 *
 * `onFrame` runs ~60 times per second (for the camera and car marker).
 * The returned value updates ~10 times per second (for the text on screen),
 * which keeps mid-range phones smooth.
 */
export function useSimulatedDrive(
  prepared: PreparedRoute | null,
  onFrame: (frame: DriveFrame) => void,
  mode: TravelMode = 'driving',
): DriveFrame | null {
  const [uiFrame, setUiFrame] = useState<DriveFrame | null>(null);
  const onFrameRef = useRef(onFrame);

  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (!prepared) return;
    const { line } = prepared;
    const { cruise, turn } = SPEEDS[mode];
    let traveled = 0;
    let speed = 0; // metres per second
    let bearing = bearingDegrees(line.coords[0], pointAlong(line, 25));
    let last = performance.now();
    let lastUi = 0;
    let raf = 0;

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.1);
      last = now;

      // Slow down before turns, speed up on straight roads.
      const { distanceToManeuver, stepIndex } = computeProgress(prepared, traveled);
      // Cars go faster on expressways (also makes the lanes & tolls demo quicker to present).
      const onHighway = mode === 'driving' && prepared.route.steps[stepIndex]?.highway;
      const target = (distanceToManeuver < 70 ? turn : onHighway ? HIGHWAY_KMH : cruise) / 3.6;
      const change = target - speed;
      speed += Math.max(-3 * dt, Math.min(2 * dt, change));

      traveled = Math.min(traveled + speed * dt, line.length);
      if (import.meta.env.DEV) {
        // Dev only: window.__nnSimSkip = 500 jumps the simulated car 500 m ahead (for testing).
        const w = window as unknown as { __nnSimSkip?: number };
        if (w.__nnSimSkip) {
          traveled = Math.min(traveled + w.__nnSimSkip, line.length);
          w.__nnSimSkip = 0;
        }
      }
      const finished = traveled >= line.length;
      const position = pointAlong(line, traveled);
      if (!finished) {
        const ahead = pointAlong(line, Math.min(traveled + 25, line.length));
        bearing = lerpAngle(bearing, bearingDegrees(position, ahead), Math.min(1, dt * 3));
      }

      const frame: DriveFrame = {
        position,
        bearing,
        traveled,
        speedKmh: finished ? 0 : speed * 3.6,
        finished,
      };
      onFrameRef.current(frame);
      if (now - lastUi > 100 || finished) {
        setUiFrame(frame);
        lastUi = now;
      }
      if (!finished) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prepared, mode]);

  return uiFrame;
}
