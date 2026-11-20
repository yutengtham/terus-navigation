import type { LngLat } from '../config/malaysia';
import type { Maneuver } from '../models/route';
import { bearingDegrees, distanceMeters, pointAlong, snapToLine } from '../utils/geo';
import { computeProgress, type PreparedRoute } from './routeProgress';

/*
 * Arrow Mode maths - pure functions, no React, so they are easy to test.
 *
 *  arrow angle = bearing from you to the target  -  the way your phone is facing
 *
 * The "target" is a point a little further along the route (so the arrow follows real roads
 * and paths round corners, not through buildings). With no route, it is the destination itself.
 */

/** How far ahead along the route the arrow aims (metres). Further when moving fast. */
export function lookAheadMeters(speedKmh: number): number {
  if (speedKmh > 15) return 70; // driving: aim further so the arrow doesn't swing at every bend
  return 22; // walking / cycling: about 25 steps ahead
}

export type ArrowTarget = {
  /** Where the arrow points */
  target: LngLat;
  /** Metres left to the destination (along the route when there is one) */
  remaining: number;
  /** Distance along the route to your snapped position (null without a route) */
  along: number | null;
  /** Sideways distance from the route in metres (null without a route) */
  offRoute: number | null;
  /** Upcoming route turn and its distance (driving view), null without a route */
  nextManeuver: Maneuver | null;
  distanceToManeuver: number | null;
  /** Route-based seconds left (traffic-aware for cars), null without a route */
  routeSecondsLeft: number | null;
  straightLine: boolean;
};

export function arrowTarget(position: LngLat, destination: LngLat, route: PreparedRoute | null, speedKmh: number): ArrowTarget {
  if (!route) {
    return {
      target: destination,
      remaining: distanceMeters(position, destination),
      along: null,
      offRoute: null,
      nextManeuver: null,
      distanceToManeuver: null,
      routeSecondsLeft: null,
      straightLine: true,
    };
  }
  const snap = snapToLine(route.line, position);
  const progress = computeProgress(route, snap.along);
  // Don't aim past the next turn: the arrow should lead you to the corner, then round it.
  const aheadLimit = snap.along + Math.max(8, progress.distanceToManeuver);
  const aim = Math.min(snap.along + lookAheadMeters(speedKmh), aheadLimit, route.line.length);
  // Near the end, aim at the actual destination (the route ends on the road, the shop may be off it).
  const nearEnd = route.line.length - snap.along < 30;
  return {
    target: nearEnd ? destination : pointAlong(route.line, aim),
    remaining: progress.remainingDistance + distanceMeters(route.line.coords[route.line.coords.length - 1], destination),
    along: snap.along,
    offRoute: snap.offset,
    nextManeuver: progress.nextManeuver,
    distanceToManeuver: progress.distanceToManeuver,
    routeSecondsLeft: progress.remainingDuration,
    straightLine: false,
  };
}

/** Signed angle in -180..180 (positive = target is to your right). */
export function relativeAngle(bearingToTarget: number, heading: number): number {
  return ((bearingToTarget - heading + 540) % 360) - 180;
}

export function arrowAngle(position: LngLat, target: LngLat, heading: number): number {
  return relativeAngle(bearingDegrees(position, target), heading);
}

export type ArrowTone = 'good' | 'near' | 'wrong';

/** Green within ±20°, red when facing mostly away (beyond ±120°), amber in between. */
export function arrowTone(angle: number): ArrowTone {
  const a = Math.abs(angle);
  if (a <= 20) return 'good';
  if (a <= 120) return 'near';
  return 'wrong';
}

export type VoiceCue = 'goStraight' | 'turnLeft' | 'turnRight';

/** Which cue fits this angle (null in the "dead zone" so small wobbles say nothing). */
export function cueForAngle(angle: number): VoiceCue | null {
  if (Math.abs(angle) <= 20) return 'goStraight';
  if (angle >= 45) return 'turnRight';
  if (angle <= -45) return 'turnLeft';
  return null;
}

/** Arrived when within this many metres (a bit more if GPS itself is unsure). */
export function arrivalRadius(accuracy: number): number {
  return Math.min(35, Math.max(25, accuracy * 0.8));
}

/** Off route = clearly further from the line than GPS error can explain. */
export function isOffRoute(offset: number | null, accuracy: number): boolean {
  return offset !== null && accuracy <= 50 && offset > Math.max(30, accuracy * 1.2);
}

/**
 * Seconds left. Uses your current speed when moving (so it is right for walking OR driving);
 * when standing still, falls back to the route estimate, then to walking pace (4.8 km/h).
 */
export function secondsLeft(remaining: number, speedKmh: number, routeSecondsLeft: number | null): number {
  if (speedKmh >= 2) return remaining / (speedKmh / 3.6);
  if (routeSecondsLeft !== null) return routeSecondsLeft;
  return remaining / (4.8 / 3.6);
}

/** Exponential smoothing for angles (handles the 359° -> 0° wrap). */
export function smoothAngle(current: number, target: number, factor: number): number {
  const diff = ((target - current + 540) % 360) - 180;
  return current + diff * factor;
}
