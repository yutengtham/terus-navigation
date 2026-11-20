import type { LngLat } from './malaysia';

export type DemoRoute = {
  id: string;
  label: string;
  from: { name: string; coords: LngLat };
  to: { name: string; coords: LngLat };
};

/**
 * Test Route A from the Terus test plan (KLCC area -> Pavilion KL).
 * Both ends are on PUBLIC roads (Jalan Ampang beside KLCC, Jalan Bukit Bintang at
 * Pavilion). The old start point was on the private driveway under the Petronas
 * Towers, which put the car and camera inside the buildings.
 * Checked with the Directions API: Jalan Ampang -> Jalan Tun Razak -> Jalan Bukit Bintang, ~3.2 km.
 * The ROUTE itself comes from the real Mapbox Directions API - only the car's
 * movement along it is simulated.
 */
export const DEMO_ROUTE_A: DemoRoute = {
  id: 'A',
  label: 'KLCC (Jalan Ampang) → Pavilion KL',
  from: { name: 'Jalan Ampang, KLCC', coords: [101.715, 3.16] },
  to: { name: 'Pavilion Kuala Lumpur', coords: [101.7126, 3.1477] },
};

/**
 * Lanes & tolls demo: Bangsar -> Damansara Utama via Kerinchi Link and Damansara Link (SPRINT).
 * Checked with the Directions API (20 Nov 2026): ~13 km, 15 junctions with Mapbox lane data
 * (4-lane splits at the Kerinchi Link exits) and two toll plazas - Plaza Tol Pantai (RM2.50)
 * and Plaza Tol Damansara (RM2.00). Driven by car in the simulated drive.
 */
export const DEMO_ROUTE_B: DemoRoute = {
  id: 'B',
  label: 'Bangsar → Damansara Utama (Kerinchi Link, 2 tolls)',
  from: { name: 'Lorong Abdullah, Bangsar', coords: [101.679, 3.13] },
  to: { name: 'Damansara Utama (SS 21)', coords: [101.62, 3.136] },
};
