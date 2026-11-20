// Map colouring for route stretches with official alerts: a soft wide band UNDER the route line
// and lane ribbon (so it glows around the road instead of covering it), with a slow moving
// dash pattern. Amber = advisory / rain / storm; red = flood warning or anything at danger level.

import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { FeatureCollection, LineString } from 'geojson';
import type { LngLat } from '../config/malaysia';
import type { RouteHazard } from '../models/hazard';
import { pointAlong, type MeasuredLine } from '../utils/geo';

const SOURCE = 'nn-hazards';
const BAND = 'nn-hazard-band';
const DASH = 'nn-hazard-dash';
export const HAZARD_AMBER = '#F5A524';
export const HAZARD_RED = '#E5484D';

export function hazardColour(h: Pick<RouteHazard, 'type' | 'severity'>): string {
  return h.severity === 'danger' || (h.type === 'flood' && h.severity === 'warning') ? HAZARD_RED : HAZARD_AMBER;
}

/** The part of the line between two distances (metres). */
export function sliceLine(line: MeasuredLine, fromM: number, toM: number): LngLat[] {
  const a = Math.max(0, Math.min(fromM, toM));
  const b = Math.min(line.length, Math.max(fromM, toM));
  const pts: LngLat[] = [pointAlong(line, a)];
  line.cumulative.forEach((d, i) => {
    if (d > a && d < b) pts.push(line.coords[i]);
  });
  pts.push(pointAlong(line, b));
  return pts;
}

function toFeatures(line: MeasuredLine, hazards: RouteHazard[]): FeatureCollection<LineString, { colour: string; rank: number }> {
  return {
    type: 'FeatureCollection',
    // Red drawn last (on top) where stretches overlap.
    features: [...hazards]
      .sort((x, y) => (hazardColour(x) === HAZARD_RED ? 1 : 0) - (hazardColour(y) === HAZARD_RED ? 1 : 0))
      .map((h) => ({
        type: 'Feature' as const,
        properties: { colour: hazardColour(h), rank: hazardColour(h) === HAZARD_RED ? 1 : 0 },
        geometry: { type: 'LineString' as const, coordinates: sliceLine(line, h.segment.startKm * 1000, h.segment.endKm * 1000) },
      })),
  };
}

// Mapbox "ant line" animation: step through dash patterns that shift the gaps along the line.
const DASH_STEPS: number[][] = [
  [0, 4, 3],
  [0.5, 4, 2.5],
  [1, 4, 2],
  [1.5, 4, 1.5],
  [2, 4, 1],
  [2.5, 4, 0.5],
  [3, 4, 0],
  [0, 0.5, 3, 3.5],
  [0, 1, 3, 3],
  [0, 1.5, 3, 2.5],
  [0, 2, 3, 2],
  [0, 2.5, 3, 1.5],
  [0, 3, 3, 1],
  [0, 3.5, 3, 0.5],
];
let timer: number | undefined;

const width = (scale: number) =>
  ['interpolate', ['exponential', 2], ['zoom'], 11, 12 * scale, 15, 26 * scale, 17, 50 * scale, 19, 120 * scale] as unknown as number;

/** Draws (or updates) the hazard stretches for one route. Safe to call repeatedly. */
export function showHazardSegments(map: MapboxMap, line: MeasuredLine, hazards: RouteHazard[]): void {
  try {
    const data = toFeatures(line, hazards);
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (src) src.setData(data);
    else map.addSource(SOURCE, { type: 'geojson', data });
    // Under the route line (and so under the lane ribbon, which sits above the route).
    const before = ['nn-route-casing', 'nn-lanes-surface', 'nn-car-layer'].find((id) => map.getLayer(id));
    if (!map.getLayer(BAND)) {
      map.addLayer(
        {
          id: BAND,
          type: 'line',
          source: SOURCE,
          slot: 'middle',
          layout: { 'line-cap': 'round', 'line-join': 'round', 'line-sort-key': ['get', 'rank'] },
          paint: { 'line-color': ['get', 'colour'], 'line-width': width(1), 'line-opacity': 0.28, 'line-blur': width(0.25), 'line-emissive-strength': 1 },
        },
        before,
      );
    }
    if (!map.getLayer(DASH)) {
      map.addLayer(
        {
          id: DASH,
          type: 'line',
          source: SOURCE,
          slot: 'middle',
          layout: { 'line-join': 'round', 'line-sort-key': ['get', 'rank'] },
          paint: { 'line-color': ['get', 'colour'], 'line-width': width(0.55), 'line-opacity': 0.35, 'line-dasharray': DASH_STEPS[0], 'line-emissive-strength': 1 },
        },
        before,
      );
    }
    if (timer === undefined) {
      let step = 0;
      timer = window.setInterval(() => {
        if (document.hidden || !map.getLayer(DASH)) return;
        step = (step + 1) % DASH_STEPS.length;
        map.setPaintProperty(DASH, 'line-dasharray', DASH_STEPS[step]);
      }, 140);
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Terus hazards] map layer failed', err);
  }
}

export function clearHazardSegments(map: MapboxMap): void {
  window.clearInterval(timer);
  timer = undefined;
  try {
    if (map.getLayer(DASH)) map.removeLayer(DASH);
    if (map.getLayer(BAND)) map.removeLayer(BAND);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  } catch {
    /* map already gone */
  }
}
