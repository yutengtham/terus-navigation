import type { ExpressionSpecification, GeoJSONSource, Map as MapboxMap, ModelSourceModelsSpecification } from 'mapbox-gl';
import type { LngLat } from '../config/malaysia';
import { colors } from '../theme/colors';

const ROUTE_SOURCE = 'nn-route';
const ROUTE_END_SOURCE = 'nn-route-end';
const ROUTE_LAYERS = ['nn-route-end', 'nn-route-chevrons', 'nn-route-line', 'nn-route-casing'];
const CHEVRON_IMAGE = 'nn-chevron';

/** Route width grows as you zoom in, like a real road. */
const routeWidth = (factor: number): ExpressionSpecification => [
  'interpolate',
  ['exponential', 1.5],
  ['zoom'],
  12, 4 * factor,
  15, 9 * factor,
  17, 20 * factor,
  19, 56 * factor,
];

/** Draws a white double chevron ">>" that gets repeated along the route. */
function createChevronImage(): ImageData {
  const w = 56;
  const h = 40;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const x of [12, 28]) {
    ctx.beginPath();
    ctx.moveTo(x, 8);
    ctx.lineTo(x + 13, 20);
    ctx.lineTo(x, 32);
    ctx.stroke();
  }
  return ctx.getImageData(0, 0, w, h);
}

/** Route layers are always inserted below the 3D car, otherwise the flat line paints over it. */
const belowCar = (map: MapboxMap) => (map.getLayer('nn-car-layer') ? 'nn-car-layer' : undefined);

/** Show (or update) the mint-green route line with chevrons. */
export function showRoute(map: MapboxMap, coordinates: LngLat[]): void {
  const data = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'LineString' as const, coordinates },
  };

  const end = {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Point' as const, coordinates: coordinates[coordinates.length - 1] },
  };

  const existing = map.getSource(ROUTE_SOURCE) as GeoJSONSource | undefined;
  if (existing) {
    existing.setData(data);
    (map.getSource(ROUTE_END_SOURCE) as GeoJSONSource | undefined)?.setData(end);
    return;
  }

  map.addSource(ROUTE_SOURCE, { type: 'geojson', data });
  if (!map.hasImage(CHEVRON_IMAGE)) map.addImage(CHEVRON_IMAGE, createChevronImage(), { pixelRatio: 2 });

  // "slot: middle" puts the route above roads but below 3D buildings and labels.
  // "emissive-strength: 1" keeps the colour bright regardless of day/night lighting.
  map.addLayer({
    id: 'nn-route-casing',
    type: 'line',
    source: ROUTE_SOURCE,
    slot: 'middle',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': '#DFFBF2',
      'line-width': routeWidth(1.18),
      'line-opacity': 0.95,
      'line-emissive-strength': 1,
    },
  }, belowCar(map));
  map.addLayer({
    id: 'nn-route-line',
    type: 'line',
    source: ROUTE_SOURCE,
    slot: 'middle',
    layout: { 'line-join': 'round', 'line-cap': 'round' },
    paint: {
      'line-color': colors.navGreen,
      'line-width': routeWidth(1),
      'line-emissive-strength': 1,
    },
  }, belowCar(map));
  map.addLayer({
    id: 'nn-route-chevrons',
    type: 'symbol',
    source: ROUTE_SOURCE,
    slot: 'middle',
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 90,
      'icon-image': CHEVRON_IMAGE,
      'icon-size': ['interpolate', ['linear'], ['zoom'], 14, 0.45, 17, 1, 19, 1.6],
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-rotation-alignment': 'map',
      'icon-pitch-alignment': 'map',
    },
    paint: { 'icon-opacity': 0.95, 'icon-emissive-strength': 1 },
  }, belowCar(map));

  // Destination dot: drawn on the ground as part of the map (not floating on top).
  map.addSource(ROUTE_END_SOURCE, { type: 'geojson', data: end });
  map.addLayer({
    id: 'nn-route-end',
    type: 'circle',
    source: ROUTE_END_SOURCE,
    slot: 'middle',
    paint: {
      'circle-color': colors.navGreen,
      'circle-radius': ['interpolate', ['exponential', 2], ['zoom'], 14, 4, 19, 26],
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 2, 19, 6],
      'circle-pitch-alignment': 'map',
      'circle-emissive-strength': 1,
    },
  }, belowCar(map));
}

export function clearRoute(map: MapboxMap): void {
  for (const id of ROUTE_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(ROUTE_SOURCE)) map.removeSource(ROUTE_SOURCE);
  if (map.getSource(ROUTE_END_SOURCE)) map.removeSource(ROUTE_END_SOURCE);
}

// ---------------- 3D car ----------------
// The car is a real 3D model (public/models/car.glb, made for Terus) drawn by Mapbox
// as part of the 3D scene ("common-3d"). That means it is depth-tested against the
// buildings: it sits ON the road surface and can never be drawn on top of a rooftop.
const CAR_SOURCE = 'nn-car';
const CAR_LAYER = 'nn-car-layer';
/**
 * One 3D model per travel mode, all made for Terus (tools: make_car.py, make_figures.py).
 * Each is shown larger than life so it is easy to see from the navigation camera:
 * car ~4.6 m long x2.5, walker ~1.75 m tall x5.5, bicycle + rider ~1.75 m long x4.5.
 */
const VEHICLES = {
  driving: { uri: new URL('/models/car.glb', window.location.href).href, scale: 2.5 },
  walking: { uri: new URL('/models/walker.glb', window.location.href).href, scale: 5.5 },
  cycling: { uri: new URL('/models/bike.glb', window.location.href).href, scale: 4.5 },
} as const;
export type VehicleKind = keyof typeof VEHICLES;
let currentVehicle: VehicleKind = 'driving';

type CarModelSource = { setModels: (models: ModelSourceModelsSpecification) => void };

/**
 * The model points east at rotation 0, and Mapbox rotates models clockwise
 * (same direction as a compass bearing), so heading = bearing - 90 degrees.
 */
/** A custom avatar model (built in the browser or uploaded) used instead of the preset. */
export type AvatarModel = { uri: string; scale: number };
let currentModel: AvatarModel | null = null;
/** Extra turn (degrees) for the arrival spin animation. */
let spinOffset = 0;

function carModels(position: LngLat, bearing: number): ModelSourceModelsSpecification {
  const uri = currentModel?.uri ?? VEHICLES[currentVehicle].uri;
  return { car: { uri, position, orientation: [0, 0, bearing - 90 + spinOffset] } };
}

/**
 * Adds the 3D car - or the walker / bicycle for walking and cycling - or the user's avatar
 * (`model`), at the same position and heading the car would have.
 */
export function addCar(map: MapboxMap, position: LngLat, bearing: number, kind: VehicleKind = 'driving', model: AvatarModel | null = null): void {
  removeCar(map);
  currentVehicle = kind;
  currentModel = model;
  spinOffset = 0;
  const scale = model?.scale ?? VEHICLES[kind].scale;
  map.addSource(CAR_SOURCE, { type: 'model', models: carModels(position, bearing) });
  map.addLayer({
    id: CAR_LAYER,
    type: 'model',
    source: CAR_SOURCE,
    slot: 'middle',
    paint: {
      'model-type': 'common-3d', // depth-tested with buildings
      'model-scale': [scale, scale, scale],
      'model-cast-shadows': true,
      'model-receive-shadows': false,
      // At night the model would be shaded almost black; let it glow a little instead.
      'model-emissive-strength': map.getConfigProperty('basemap', 'lightPreset') === 'night' ? CAR_NIGHT_GLOW : 0,
    },
  });
}

const CAR_NIGHT_GLOW = 0.75;

/** Called every animation frame - updates position/heading without reloading the model. */
export function moveCar(map: MapboxMap, position: LngLat, bearing: number): void {
  const source = map.getSource(CAR_SOURCE) as unknown as CarModelSource | undefined;
  source?.setModels(carModels(position, bearing));
}

/** Lifts the avatar off the road by `metres` (idle bob / arrival hop). Cheap: one paint update. */
export function setCarLift(map: MapboxMap, metres: number): void {
  if (map.getLayer(CAR_LAYER)) map.setPaintProperty(CAR_LAYER, 'model-translation', [0, 0, metres]);
}

/** Extra turn for the arrival spin (applied on the next moveCar). */
export function setCarSpin(degrees: number): void {
  spinOffset = degrees;
}

export function removeCar(map: MapboxMap): void {
  if (map.getLayer(CAR_LAYER)) map.removeLayer(CAR_LAYER);
  if (map.getSource(CAR_SOURCE)) map.removeSource(CAR_SOURCE);
}

/**
 * Detailed 3D on/off. Off hides 3D trees, landmark models and facades (buildings stay),
 * which noticeably lightens the GPU work on mid-range Android phones.
 */
export function setDetailed3d(map: MapboxMap, on: boolean): void {
  map.setConfigProperty('basemap', 'show3dTrees', on);
  map.setConfigProperty('basemap', 'show3dLandmarks', on);
  map.setConfigProperty('basemap', 'show3dFacades', on);
}

/**
 * "Front cutoff": while navigating, hide 3D buildings, landmark models and trees whose base is
 * in the lower part of the screen - the area between the camera and the car - so a building
 * can never block the view of the car or the next turn. Buildings further ahead stay.
 * Values: [start, fade range, opacity] as fractions of the screen height from the bottom.
 * The car sits about 30% up from the bottom (see navPadding), so we cut below ~30% and
 * fade between 30% and 40%. Mapbox switches this off automatically in flat (2D) views.
 */
const FRONT_CUTOFF_ON: [number, number, number] = [0.4, 0.1, 0];
const FRONT_CUTOFF_OFF: [number, number, number] = [0, 0, 1];
const CUTOFF_LAYERS: [string, string][] = [
  ['3d-building', 'fill-extrusion-front-cutoff'],
  ['2d-building', 'fill-extrusion-front-cutoff'],
  ['procedural-buildings', 'building-front-cutoff'],
  ['building-models', 'model-front-cutoff'], // landmark models (e.g. Petronas Towers)
  ['trees', 'model-front-cutoff'],
];

type FragmentStyle = { setPaintProperty: (layer: string, name: string, value: unknown) => void };

export function setBuildingFrontCutoff(map: MapboxMap, on: boolean): void {
  // These layers live inside the imported Mapbox Standard style ("basemap"), which only exposes
  // its own settings through config. getFragmentStyle reaches the imported style's layers.
  const style = (map as unknown as { style?: { getFragmentStyle?: (id: string) => FragmentStyle | undefined } }).style;
  const basemap = style?.getFragmentStyle?.('basemap');
  if (!basemap) return;
  for (const [layer, property] of CUTOFF_LAYERS) {
    try {
      basemap.setPaintProperty(layer, property, on ? FRONT_CUTOFF_ON : FRONT_CUTOFF_OFF);
    } catch {
      /* layer not present in this version of the style - skip it */
    }
  }
  map.triggerRepaint();
}

/**
 * 3D or flat 2D map. 2D: no tilt (max pitch 0, so every camera move stays top-down) and no
 * 3D buildings / trees / landmarks. Works for every screen without changing their camera code.
 */
export function setMapView(map: MapboxMap, view: '3d' | '2d'): void {
  const flat = view === '2d';
  map.setMaxPitch(flat ? 0 : 75);
  map.setConfigProperty('basemap', 'show3dObjects', !flat);
  if (flat && map.getPitch() > 0) map.easeTo({ pitch: 0, duration: 600 });
}

/** Day / night switch for the Mapbox Standard style. */
export function setLightPreset(map: MapboxMap, preset: 'day' | 'night'): void {
  map.setConfigProperty('basemap', 'lightPreset', preset);
  if (map.getLayer(CAR_LAYER)) map.setPaintProperty(CAR_LAYER, 'model-emissive-strength', preset === 'night' ? CAR_NIGHT_GLOW : 0);
}

// ---------------- Your location (blue dot + accuracy circle) ----------------
// Drawn as map layers on the ground (not floating HTML), like the car and route.
const USER_SOURCE = 'nn-user';
const USER_LAYERS = ['nn-user-dot', 'nn-user-accuracy'];

/** Pixel radius that represents `meters` on the ground at each zoom level. */
function metersToPixels(meters: number, latitude: number): ExpressionSpecification {
  const metersPerPixelZ0 = 156543.03392 * Math.cos((latitude * Math.PI) / 180);
  return ['interpolate', ['exponential', 2], ['zoom'], 0, meters / metersPerPixelZ0, 22, (meters / metersPerPixelZ0) * 2 ** 22];
}

export function showUserLocation(map: MapboxMap, position: LngLat, accuracy: number): void {
  const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: position } };
  const radius = metersToPixels(Math.min(accuracy, 2000), position[1]);
  const source = map.getSource(USER_SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    map.setPaintProperty('nn-user-accuracy', 'circle-radius', radius);
    return;
  }
  map.addSource(USER_SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: 'nn-user-accuracy',
    type: 'circle',
    source: USER_SOURCE,
    slot: 'middle',
    paint: {
      'circle-radius': radius,
      'circle-color': colors.primaryBlue,
      'circle-opacity': 0.12,
      'circle-stroke-color': colors.primaryBlue,
      'circle-stroke-opacity': 0.3,
      'circle-stroke-width': 1,
      'circle-pitch-alignment': 'map',
      'circle-emissive-strength': 1,
    },
  });
  map.addLayer({
    id: 'nn-user-dot',
    type: 'circle',
    source: USER_SOURCE,
    slot: 'middle',
    paint: {
      'circle-radius': 8,
      'circle-color': colors.primaryBlue,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 3,
      'circle-pitch-alignment': 'map',
      'circle-emissive-strength': 1,
    },
  });
}

export function clearUserLocation(map: MapboxMap): void {
  for (const id of USER_LAYERS) if (map.getLayer(id)) map.removeLayer(id);
  if (map.getSource(USER_SOURCE)) map.removeSource(USER_SOURCE);
}

// ---------------- Searched destination pin ----------------
const DEST_SOURCE = 'nn-dest';

export function showDestinationPin(map: MapboxMap, position: LngLat): void {
  const data = { type: 'Feature' as const, properties: {}, geometry: { type: 'Point' as const, coordinates: position } };
  const source = map.getSource(DEST_SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(DEST_SOURCE, { type: 'geojson', data });
  map.addLayer({
    id: 'nn-dest-pin',
    type: 'circle',
    source: DEST_SOURCE,
    slot: 'middle',
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 7, 17, 13],
      'circle-color': colors.navGreen,
      'circle-stroke-color': '#FFFFFF',
      'circle-stroke-width': 4,
      'circle-pitch-alignment': 'map',
      'circle-emissive-strength': 1,
    },
  });
}

export function clearDestinationPin(map: MapboxMap): void {
  if (map.getLayer('nn-dest-pin')) map.removeLayer('nn-dest-pin');
  if (map.getSource(DEST_SOURCE)) map.removeSource(DEST_SOURCE);
}

// ---------------- Alternative routes (soft blue, tappable) ----------------
const ALT_SOURCE = 'nn-alt-routes';
export const ALT_LAYER = 'nn-alt-routes-line';

/** Draws the non-selected route choices in soft blue (grey would blend into side streets). */
export function showAlternatives(map: MapboxMap, routes: LngLat[][], selected: number): void {
  const data = {
    type: 'FeatureCollection' as const,
    features: routes
      .map((coordinates, index) => ({
        type: 'Feature' as const,
        properties: { index },
        geometry: { type: 'LineString' as const, coordinates },
      }))
      .filter((f) => f.properties.index !== selected),
  };
  const source = map.getSource(ALT_SOURCE) as GeoJSONSource | undefined;
  if (source) {
    source.setData(data);
    return;
  }
  map.addSource(ALT_SOURCE, { type: 'geojson', data });
  map.addLayer(
    {
      id: ALT_LAYER,
      type: 'line',
      source: ALT_SOURCE,
      slot: 'middle',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#7FA8E6',
        'line-width': routeWidth(0.85),
        'line-opacity': 0.9,
        'line-emissive-strength': 1,
      },
    },
    map.getLayer('nn-route-casing') ? 'nn-route-casing' : undefined, // keep under the selected route
  );
}

export function clearAlternatives(map: MapboxMap): void {
  if (map.getLayer(ALT_LAYER)) map.removeLayer(ALT_LAYER);
  if (map.getSource(ALT_SOURCE)) map.removeSource(ALT_SOURCE);
}
