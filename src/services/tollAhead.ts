import type { TollRate } from '../config/tollRates';
import type { TollPlaza } from '../models/route';
import { distanceMeters, snapToLine, type MeasuredLine } from '../utils/geo';
import { findRate, normalisePlazaName } from './tollEstimate';

/*
 * "Next toll" reminder: where each toll plaza is along the route, and how far the next ones
 * are from where you are now. Plazas come from Mapbox (steps[].intersections[].toll_collection);
 * prices from the verified table via tollEstimate (null = not priced, never guessed).
 */

export type TollPoint = {
  name: string;
  /** Metres from the start of the route line to the plaza */
  along: number;
  rate: TollRate | null;
};

export type UpcomingToll = TollPoint & {
  /** Metres from your current position to the plaza */
  distance: number;
};

/** Places every plaza on the route line once (Mapbox may list both sides of a booth). */
export function placeTolls(line: MeasuredLine, plazas: TollPlaza[]): TollPoint[] {
  const points: (TollPoint & { location: TollPlaza['location'] })[] = [];
  for (const p of plazas) {
    const dup = points.some(
      (q) => normalisePlazaName(q.name) === normalisePlazaName(p.name) && distanceMeters(q.location, p.location) < 400,
    );
    if (dup) continue;
    points.push({ name: p.name, along: snapToLine(line, p.location).along, rate: findRate(p), location: p.location });
  }
  return points.sort((a, b) => a.along - b.along).map(({ name, along, rate }) => ({ name, along, rate }));
}

/** A plaza counts as passed once you are this far beyond it (GPS jitter margin). */
const PASSED_AFTER_M = 15;

/** Plazas still ahead of `traveled` metres, nearest first, with their distance from you. */
export function upcomingTolls(points: TollPoint[], traveled: number): UpcomingToll[] {
  return points
    .filter((p) => p.along > traveled - PASSED_AFTER_M)
    .map((p) => ({ ...p, distance: Math.max(0, p.along - traveled) }));
}

/** "Plaza Tol Pantai (B)" -> "Pantai" for the small card. */
export function shortPlazaName(name: string): string {
  return name
    .replace(/^(plaza\s+tol+|toll?\s+plaza)\s*/i, '')
    .replace(/\s*\((arah [^)]*|[A-Z])\)\s*$/i, '')
    .trim();
}
