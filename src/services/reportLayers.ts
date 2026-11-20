// Small warning pins on the map for the user's own reports.
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import type { RoadReport } from '../models/report';

const SOURCE = 'nn-reports';
const LAYER = 'nn-reports-pins';
const ICON = 'nn-report-pin';

function pinImage(): ImageData | null {
  const s = 64;
  const c = document.createElement('canvas');
  c.width = c.height = s;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(32, 58, 12, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffcc00';
  ctx.strokeStyle = '#3b2414';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(32, 6);
  ctx.lineTo(58, 52);
  ctx.lineTo(6, 52);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#3b2414';
  ctx.fillRect(29, 20, 6, 18);
  ctx.fillRect(29, 42, 6, 6);
  return ctx.getImageData(0, 0, s, s);
}

export function showReportPins(map: MapboxMap, reports: RoadReport[]): void {
  try {
    if (!map.hasImage(ICON)) {
      const img = pinImage();
      if (img) map.addImage(ICON, img, { pixelRatio: 2 });
    }
    const data = {
      type: 'FeatureCollection' as const,
      features: reports.map((r) => ({ type: 'Feature' as const, properties: { id: r.id }, geometry: { type: 'Point' as const, coordinates: r.location } })),
    };
    const src = map.getSource(SOURCE) as GeoJSONSource | undefined;
    if (src) src.setData(data);
    else map.addSource(SOURCE, { type: 'geojson', data });
    if (!map.getLayer(LAYER)) {
      map.addLayer({
        id: LAYER,
        type: 'symbol',
        source: SOURCE,
        slot: 'top',
        minzoom: 11,
        layout: { 'icon-image': ICON, 'icon-anchor': 'bottom', 'icon-allow-overlap': true, 'icon-size': ['interpolate', ['linear'], ['zoom'], 11, 0.6, 17, 1] },
      });
    }
  } catch (err) {
    if (import.meta.env.DEV) console.warn('[Terus reports] pins failed', err);
  }
}

export function clearReportPins(map: MapboxMap): void {
  try {
    if (map.getLayer(LAYER)) map.removeLayer(LAYER);
    if (map.getSource(SOURCE)) map.removeSource(SOURCE);
  } catch {
    /* map gone */
  }
}
