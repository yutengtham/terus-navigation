import { TOLL_RATES, type TollRate } from '../config/tollRates';
import type { NavRoute, TollPlaza } from '../models/route';
import { distanceMeters } from '../utils/geo';

/*
 * Toll estimate for a car (Class 1), from the plazas Mapbox says the route passes and the
 * verified open-system rates in config/tollRates.ts. Plazas we have no verified price for
 * (distance-based highways like PLUS, or unconfirmed rates) are listed as "not priced" - we
 * never guess a number.
 */

export type TollEstimate = {
  /** Sum of the priced plazas, in RM */
  total: number;
  priced: { plaza: string; highway: string; rm: number }[];
  /** Plaza names we couldn't price (closed system / not verified) */
  unpriced: string[];
  /** true when every plaza on the route was priced */
  complete: boolean;
};

/** "Plaza Tol Pantai Dalam (B)" -> "pantai dalam"; "Plaza Toll SMART Sungai Besi" -> "smart sungai besi" */
export function normalisePlazaName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\((arah [^)]*|[a-z])\)/g, ' ') // (A), (B), (T), (Arah Timur)
    .replace(/\b(plaza\s+tol+|toll?\s+plaza)\b/g, ' ')
    .replace(/['’.]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findRate(plaza: TollPlaza): TollRate | null {
  const name = normalisePlazaName(plaza.name);
  if (!name) return null;
  for (const rate of TOLL_RATES) {
    if (!rate.names.includes(name)) continue;
    const refMatches = plaza.refs.some((r) => rate.refs.includes(r));
    // A different route number means a different highway with the same plaza name.
    if (plaza.refs.length > 0 && !refMatches) continue;
    if (rate.needsRef && !refMatches) continue;
    return rate;
  }
  return null;
}

export function estimateTolls(route: NavRoute): TollEstimate {
  // Mapbox can list the same plaza twice (both sides of a booth); count each plaza once.
  const plazas: TollPlaza[] = [];
  for (const p of route.tollPlazas) {
    const dup = plazas.some(
      (q) => normalisePlazaName(q.name) === normalisePlazaName(p.name) && distanceMeters(q.location, p.location) < 400,
    );
    if (!dup) plazas.push(p);
  }
  const priced: TollEstimate['priced'] = [];
  const unpriced: string[] = [];
  for (const p of plazas) {
    const rate = findRate(p);
    if (rate) priced.push({ plaza: p.name, highway: rate.highway, rm: rate.rm });
    else unpriced.push(p.name || 'Unnamed toll plaza');
  }
  const total = Math.round(priced.reduce((sum, p) => sum + p.rm, 0) * 100) / 100;
  // A toll road with no plaza listed (Mapbox data gap) can't be called complete either.
  const complete = unpriced.length === 0 && (priced.length > 0 || !route.hasTolls);
  return { total, priced, unpriced, complete };
}

export function formatRM(rm: number): string {
  return `RM${rm.toFixed(2)}`;
}
