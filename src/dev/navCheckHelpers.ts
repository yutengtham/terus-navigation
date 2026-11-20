import type { LngLat } from '../config/malaysia';
import { measureLine } from '../utils/geo';

/** Length of a polyline in metres (independent helper for the checks). */
export function routeLineLength(coords: LngLat[]): number {
  return measureLine(coords).length;
}
