// Malaysia-first defaults for Terus.

/** [longitude, latitude] - Mapbox always uses longitude first. */
export type LngLat = [number, number];

export const MALAYSIA = {
  country: 'Malaysia',
  countryCode: 'MY',
  language: 'en',
  timeZone: 'Asia/Kuala_Lumpur',
  currency: 'MYR',
  drivingSide: 'left',
  units: { distance: 'km', speed: 'km/h' },
} as const;

/** Kuala Lumpur city centre (3.1390 N, 101.6869 E). */
export const KUALA_LUMPUR: LngLat = [101.6869, 3.139];

/**
 * Rough box around all of Malaysia (Peninsular + Sabah + Sarawak).
 * Used later to keep search results inside Malaysia.
 * Order: [west, south, east, north]
 */
export const MALAYSIA_BOUNDS: [number, number, number, number] = [99.6, 0.85, 119.3, 7.4];

/** Initial 3D camera: tilted, forward-looking view over KL. */
export const INITIAL_CAMERA = {
  center: KUALA_LUMPUR,
  zoom: 15.6,
  pitch: 62, // tilt in degrees (0 = flat, 85 = max)
  bearing: -20, // rotation in degrees
} as const;
