import { useEffect, useRef, useState } from 'react';
import type { GpsFix } from '../services/locationService';
import type { PreparedRoute } from '../services/routeProgress';
import { bearingAlong, lerpAngle, snapToLine } from '../utils/geo';
import type { DriveFrame } from './useSimulatedDrive';

export type LiveFrame = DriveFrame & {
  /** The car has left the route (confirmed over several GPS readings) */
  offRoute: boolean;
};

/** Sideways distance from the route that still counts as "on the route" (metres). */
const ON_ROUTE_TOLERANCE_M = 35;
/** How many off-route readings in a row before we believe it (filters GPS jumps). */
const OFF_ROUTE_READINGS = 3;
/** Readings worse than this are too vague to decide anything (metres). */
const MAX_TRUSTED_ACCURACY_M = 50;
/** Within this distance of the end = arrived (metres). */
const ARRIVED_M = 30;

/**
 * REAL navigation: turns live GPS readings into a smoothly moving car on the route.
 *  - snaps each reading onto the route ("map matching") when it is close enough
 *  - animates the car between readings (GPS updates ~once per second)
 *  - detects when you have left the route so the app can reroute
 * Never invents a position: if GPS stops, the car stops where it was last seen.
 */
export function useLiveDrive(
  prepared: PreparedRoute | null,
  fix: GpsFix | null,
  onFrame: (frame: LiveFrame) => void,
): LiveFrame | null {
  const [uiFrame, setUiFrame] = useState<LiveFrame | null>(null);
  const onFrameRef = useRef(onFrame);
  useEffect(() => {
    onFrameRef.current = onFrame;
  }, [onFrame]);

  // Animation state shared between GPS updates and the animation loop.
  const anim = useRef({
    from: null as LiveFrame | null,
    to: null as LiveFrame | null,
    startedAt: 0,
    duration: 1000,
    offCount: 0,
    lastTraveled: 0,
  });

  // New route (start / reroute): reset.
  useEffect(() => {
    anim.current = { from: null, to: null, startedAt: 0, duration: 1000, offCount: 0, lastTraveled: 0 };
    setUiFrame(null);
  }, [prepared]);

  // Each GPS reading -> a new target for the car.
  useEffect(() => {
    if (!prepared || !fix) return;
    const a = anim.current;
    const snap = snapToLine(prepared.line, fix.position);
    const trusted = fix.accuracy <= MAX_TRUSTED_ACCURACY_M;
    const tolerance = Math.max(ON_ROUTE_TOLERANCE_M, Math.min(fix.accuracy, MAX_TRUSTED_ACCURACY_M) * 1.2);
    const onRoute = snap.offset <= tolerance;

    if (!onRoute && trusted) a.offCount += 1;
    else if (onRoute) a.offCount = 0;
    const offRoute = a.offCount >= OFF_ROUTE_READINGS;

    const traveled = onRoute ? snap.along : a.lastTraveled;
    a.lastTraveled = traveled;
    const moving = (fix.speedKmh ?? 0) > 7;
    const bearing =
      moving && fix.heading != null ? fix.heading : onRoute ? bearingAlong(prepared.line, snap.along) : (a.to?.bearing ?? 0);

    const target: LiveFrame = {
      position: onRoute ? snap.point : fix.position,
      bearing,
      traveled,
      speedKmh: fix.speedKmh ?? 0,
      finished: prepared.line.length - traveled <= ARRIVED_M,
      offRoute,
    };

    const now = performance.now();
    a.from = currentFrame(a, now) ?? target;
    a.to = target;
    a.startedAt = now;
    a.duration = 1000;
    setUiFrame(target);
  }, [prepared, fix]);

  // Animation loop: glide the car from the previous reading to the latest one.
  useEffect(() => {
    if (!prepared) return;
    let raf = 0;
    const tick = (now: number) => {
      const frame = currentFrame(anim.current, now);
      if (frame) onFrameRef.current(frame);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [prepared]);

  return uiFrame;
}

function currentFrame(a: { from: LiveFrame | null; to: LiveFrame | null; startedAt: number; duration: number }, now: number): LiveFrame | null {
  if (!a.to) return null;
  if (!a.from) return a.to;
  const t = Math.min(1, (now - a.startedAt) / a.duration);
  return {
    ...a.to,
    position: [
      a.from.position[0] + (a.to.position[0] - a.from.position[0]) * t,
      a.from.position[1] + (a.to.position[1] - a.from.position[1]) * t,
    ],
    bearing: lerpAngle(a.from.bearing, a.to.bearing, t),
  };
}
