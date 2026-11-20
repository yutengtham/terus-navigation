import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { Ribbon } from './laneRibbon';

/*
 * Draws the lane ribbon (services/laneRibbon.ts) on the map, in the Standard style's "middle"
 * slot: above the normal roads, below buildings, 3D models and the car. Layer order:
 *   road surface -> recommended lane -> dashed dividers -> edge lines -> guide glow -> guide -> arrows
 * Surfaces are polygons in real metres; line widths use a zoom expression that converts metres
 * to pixels at Malaysian latitudes, so everything keeps its real size as you zoom and tilt.
 */

const SOURCE = 'nn-lanes';
export const RIBBON_MIN_ZOOM = 15.5;
const LAYERS = ['nn-lanes-surface', 'nn-lanes-rec', 'nn-lanes-divider', 'nn-lanes-edge', 'nn-lanes-glow', 'nn-lanes-guide', 'nn-lanes-arrow'] as const;
const ROUTE_LINE_LAYERS: [string, 'line-opacity' | 'icon-opacity', number][] = [
  ['nn-route-casing', 'line-opacity', 0.95],
  ['nn-route-line', 'line-opacity', 1],
  ['nn-route-chevrons', 'icon-opacity', 0.95],
];
const FADE = { duration: 450, delay: 0 };

/** Metres -> pixels for a line width, at about 3°N (512 px tiles: 78,155 m per px at zoom 0). */
function metres(m: number): ExpressionSpecification {
  return ['interpolate', ['exponential', 2], ['zoom'], 12, (m * 2 ** 12) / 78155, 22, (m * 2 ** 22) / 78155];
}

type Palette = { surface: string; rec: string; line: string; guide: string; glow: string };
const DAY: Palette = { surface: '#2F3B4C', rec: '#1F8F7A', line: '#FFFFFF', guide: '#3DDC97', glow: '#3DDC97' };
const NIGHT: Palette = { surface: '#1A2433', rec: '#1F8F7A', line: '#DCE6F0', guide: '#3DDC97', glow: '#2BC487' };

const OPACITY = { surface: 0.96, rec: 0.7, divider: 0.95, edge: 1, glow: 0.35, guide: 1, arrow: 0.95 };

// ---------- painted arrow icons (white, pointing up = forward) ----------
const ICONS = ['straight', 'left', 'right', 'slight-left', 'slight-right', 'straight-left', 'straight-right', 'uturn'] as const;

function drawArrow(kind: (typeof ICONS)[number]): ImageData {
  const w = 48;
  const h = 96;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.strokeStyle = '#FFFFFF';
  g.fillStyle = '#FFFFFF';
  g.lineWidth = 7;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const head = (x: number, y: number, angle: number) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    g.moveTo(0, -12);
    g.lineTo(10, 4);
    g.lineTo(-10, 4);
    g.closePath();
    g.fill();
    g.restore();
  };
  const stem = (x0: number, y0: number, x1: number, y1: number) => {
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.stroke();
  };
  const side = (dir: -1 | 1, slight: boolean) => {
    g.beginPath();
    g.moveTo(24, 92);
    g.lineTo(24, slight ? 50 : 46);
    if (slight) g.quadraticCurveTo(24, 34, 24 + dir * 12, 24);
    else g.quadraticCurveTo(24, 30, 24 + dir * 14, 30);
    g.stroke();
    if (slight) head(24 + dir * 15, 20, (dir * Math.PI) / 4);
    else head(24 + dir * 18, 30, (dir * Math.PI) / 2);
  };
  switch (kind) {
    case 'straight':
      stem(24, 92, 24, 20);
      head(24, 12, 0);
      break;
    case 'left':
      side(-1, false);
      break;
    case 'right':
      side(1, false);
      break;
    case 'slight-left':
      side(-1, true);
      break;
    case 'slight-right':
      side(1, true);
      break;
    case 'straight-left':
      stem(24, 92, 24, 20);
      head(24, 12, 0);
      side(-1, false);
      break;
    case 'straight-right':
      stem(24, 92, 24, 20);
      head(24, 12, 0);
      side(1, false);
      break;
    case 'uturn': // Malaysia: U-turns swing to the right
      g.beginPath();
      g.moveTo(14, 92);
      g.lineTo(14, 36);
      g.quadraticCurveTo(14, 18, 26, 18);
      g.quadraticCurveTo(36, 18, 36, 36);
      g.lineTo(36, 54);
      g.stroke();
      head(36, 64, Math.PI);
      break;
  }
  return g.getImageData(0, 0, w, h);
}

function addIcons(map: MapboxMap): void {
  for (const k of ICONS) {
    const id = `nn-lanearrow-${k}`;
    if (!map.hasImage(id)) map.addImage(id, drawArrow(k), { pixelRatio: 2 });
  }
}

/** Arrow about 3 m wide on the road: 24 css px wide image scaled with the zoom. */
const ARROW_SIZE: ExpressionSpecification = ['interpolate', ['exponential', 2], ['zoom'], 12, (3 * 2 ** 12) / 78155 / 24, 22, (3 * 2 ** 22) / 78155 / 24];

function beforeCar(map: MapboxMap): string | undefined {
  return map.getLayer('nn-car-layer') ? 'nn-car-layer' : undefined;
}

/** Adds the ribbon source + layers (hidden) if they aren't there yet. */
export function ensureRibbonLayers(map: MapboxMap, night: boolean): void {
  if (map.getSource(SOURCE)) return;
  const p = night ? NIGHT : DAY;
  addIcons(map);
  map.addSource(SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, tolerance: 0.2 });
  const common = { source: SOURCE, slot: 'middle', minzoom: RIBBON_MIN_ZOOM } as const;
  const before = beforeCar(map);
  map.addLayer(
    { id: 'nn-lanes-surface', type: 'fill', ...common, filter: ['==', ['get', 'kind'], 'surface'], paint: { 'fill-color': p.surface, 'fill-opacity': 0, 'fill-opacity-transition': FADE, 'fill-emissive-strength': 1 } },
    before,
  );
  map.addLayer(
    { id: 'nn-lanes-rec', type: 'fill', ...common, filter: ['==', ['get', 'kind'], 'recommended'], paint: { 'fill-color': p.rec, 'fill-opacity': 0, 'fill-opacity-transition': FADE, 'fill-emissive-strength': 1 } },
    before,
  );
  map.addLayer(
    {
      id: 'nn-lanes-divider',
      type: 'line',
      ...common,
      filter: ['==', ['get', 'kind'], 'divider'],
      layout: { 'line-cap': 'butt' },
      paint: { 'line-color': p.line, 'line-width': metres(0.18), 'line-opacity': 0, 'line-opacity-transition': FADE, 'line-emissive-strength': 1 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'nn-lanes-edge',
      type: 'line',
      ...common,
      filter: ['==', ['get', 'kind'], 'edge'],
      layout: { 'line-join': 'round' },
      paint: { 'line-color': p.line, 'line-width': metres(0.25), 'line-opacity': 0, 'line-opacity-transition': FADE, 'line-emissive-strength': 1 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'nn-lanes-glow',
      type: 'line',
      ...common,
      filter: ['==', ['get', 'kind'], 'guide'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': p.glow, 'line-width': metres(3.6), 'line-blur': metres(1.6), 'line-opacity': 0, 'line-opacity-transition': FADE, 'line-emissive-strength': 1 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'nn-lanes-guide',
      type: 'line',
      ...common,
      filter: ['==', ['get', 'kind'], 'guide'],
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': p.guide, 'line-width': metres(2.4), 'line-opacity': 0, 'line-opacity-transition': FADE, 'line-emissive-strength': 1 },
    },
    before,
  );
  map.addLayer(
    {
      id: 'nn-lanes-arrow',
      type: 'symbol',
      ...common,
      filter: ['==', ['get', 'kind'], 'arrow'],
      layout: {
        'icon-image': ['concat', 'nn-lanearrow-', ['get', 'icon']],
        'icon-size': ARROW_SIZE,
        'icon-rotate': ['get', 'bearing'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': 0, 'icon-opacity-transition': FADE, 'icon-emissive-strength': 1 },
    },
    before,
  );
}

export function setRibbonData(map: MapboxMap, data: Ribbon): void {
  (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(data);
}

/** Fades the ribbon in/out, and the normal route line the opposite way (at lane-view zooms only). */
export function setRibbonVisible(map: MapboxMap, on: boolean): void {
  if (!map.getSource(SOURCE)) return;
  const set = (id: string, prop: string, value: number) => {
    if (map.getLayer(id)) map.setPaintProperty(id, prop as 'fill-opacity', value);
  };
  set('nn-lanes-surface', 'fill-opacity', on ? OPACITY.surface : 0);
  set('nn-lanes-rec', 'fill-opacity', on ? OPACITY.rec : 0);
  set('nn-lanes-divider', 'line-opacity', on ? OPACITY.divider : 0);
  set('nn-lanes-edge', 'line-opacity', on ? OPACITY.edge : 0);
  set('nn-lanes-glow', 'line-opacity', on ? OPACITY.glow : 0);
  set('nn-lanes-guide', 'line-opacity', on ? OPACITY.guide : 0);
  set('nn-lanes-arrow', 'icon-opacity', on ? OPACITY.arrow : 0);
  // The normal mint route line: hidden under the lane view when zoomed in, shown when zoomed out.
  for (const [id, prop, normal] of ROUTE_LINE_LAYERS) {
    if (!map.getLayer(id)) continue;
    const value: number | ExpressionSpecification = on ? ['step', ['zoom'], normal, RIBBON_MIN_ZOOM, 0] : normal;
    map.setPaintProperty(id, prop, value);
  }
}

/** Day / night colours. */
export function setRibbonNight(map: MapboxMap, night: boolean): void {
  if (!map.getSource(SOURCE)) return;
  const p = night ? NIGHT : DAY;
  if (map.getLayer('nn-lanes-surface')) map.setPaintProperty('nn-lanes-surface', 'fill-color', p.surface);
  if (map.getLayer('nn-lanes-divider')) map.setPaintProperty('nn-lanes-divider', 'line-color', p.line);
  if (map.getLayer('nn-lanes-edge')) map.setPaintProperty('nn-lanes-edge', 'line-color', p.line);
  if (map.getLayer('nn-lanes-glow')) map.setPaintProperty('nn-lanes-glow', 'line-color', p.glow);
}

export function removeRibbon(map: MapboxMap): void {
  setRibbonVisible(map, false); // restores the normal route line
  for (const id of LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(SOURCE)) map.removeSource(SOURCE);
}
