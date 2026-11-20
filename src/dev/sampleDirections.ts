import type { ApiResponse } from '../services/directionsService';

/**
 * Excerpt of a REAL Mapbox Directions response (driving, 20 Nov 2026), Bangsar -> Damansara
 * Utama, steps 8-15: Kerinchi Link and Damansara Link (SPRINT, E23) with their lane banners,
 * junction lanes and both toll plazas. Values are copied as returned; to keep the file small
 * the route line is reduced to the maneuver and toll points, and unused fields are dropped.
 * Not from the response (marked "excerpt" below): the route totals (sum of these steps), and
 * step 7's duration and instruction text, which were cut off when the response was captured.
 * Used by the dev checks (src/dev/navChecks.ts, open the app with ?navcheck=1).
 */
const L = (lng: number, lat: number): [number, number] => [lng, lat];

export const SAMPLE_DIRECTIONS: ApiResponse = {
  code: 'Ok',
  routes: [
    {
      distance: 8521, // excerpt: sum of the steps below
      duration: 576, // excerpt: sum of the steps below
      geometry: {
        coordinates: [
          L(101.6722, 3.11444),
          L(101.66701, 3.11473),
          L(101.66192, 3.1269),
          L(101.66132, 3.13124),
          L(101.65875, 3.13449),
          L(101.65702, 3.13548),
          L(101.652, 3.13364),
          L(101.64358, 3.12836),
          L(101.63876, 3.1307),
          L(101.6195, 3.13232),
        ],
      },
      legs: [
        {
          summary: 'E23',
          steps: [
            {
              distance: 579,
              duration: 56,
              name: '',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take 2 toward Jalan Kerinchi.', location: L(101.6722, 3.11444) },
              intersections: [
                {
                  location: L(101.6722, 3.11444),
                  lanes: [
                    { active: false, valid: false, indications: ['slight left'] },
                    { active: true, valid: true, indications: ['slight right'], valid_indication: 'slight right' },
                  ],
                },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 579,
                  primary: { text: 'E23', type: 'fork', modifier: 'right' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: true, directions: ['straight'], active_direction: 'straight' },
                      { type: 'lane', text: '', active: true, directions: ['straight'], active_direction: 'straight' },
                    ],
                  },
                },
              ],
              voiceInstructions: [{ distanceAlongGeometry: 67, announcement: 'Keep right to take E23.' }],
            },
            {
              distance: 2059,
              duration: 138,
              name: 'Kerinchi Link',
              ref: 'E23',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take E23 toward E11/E1/E8.', location: L(101.66701, 3.11473) },
              intersections: [
                {
                  location: L(101.66701, 3.11473),
                  classes: ['motorway'],
                  lanes: [
                    { active: true, valid: true, indications: ['straight'], valid_indication: 'straight' },
                    { active: true, valid: true, indications: ['straight'], valid_indication: 'straight' },
                  ],
                },
              ],
              bannerInstructions: [
                { distanceAlongGeometry: 2059, primary: { text: 'Exit Plaza B E1 / E11', type: 'fork', modifier: 'right' } },
                {
                  distanceAlongGeometry: 400,
                  primary: { text: 'Exit Plaza B E1 / E11', type: 'fork', modifier: 'right' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: false, directions: ['slight left'] },
                      { type: 'lane', text: '', active: false, directions: ['slight left'] },
                      { type: 'lane', text: '', active: true, directions: ['slight right'], active_direction: 'slight right' },
                      { type: 'lane', text: '', active: true, directions: ['slight right'], active_direction: 'slight right' },
                    ],
                  },
                },
              ],
              voiceInstructions: [{ distanceAlongGeometry: 113, announcement: 'Keep right to take exit Plaza B.' }],
            },
            {
              distance: 961,
              duration: 90,
              name: '',
              ref: 'E23',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take exit Plaza B onto E1/E11 toward Plaza B/Ipoh/Kepong/Damansara.', location: L(101.66192, 3.1269) },
              intersections: [
                {
                  location: L(101.66192, 3.1269),
                  classes: ['motorway'],
                  lanes: [
                    { active: false, valid: false, indications: ['slight left'] },
                    { active: false, valid: false, indications: ['slight left'] },
                    { active: true, valid: true, indications: ['slight right'], valid_indication: 'slight right' },
                    { active: true, valid: true, indications: ['slight right'], valid_indication: 'slight right' },
                  ],
                },
                {
                  location: L(101.66132, 3.13124),
                  classes: ['toll', 'motorway'],
                  toll_collection: { type: 'toll_booth', name: 'Plaza Tol Pantai (B)' },
                },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 400,
                  primary: { text: 'Exit 2307 E23', type: 'fork', modifier: 'right' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: false, directions: ['slight left'] },
                      { type: 'lane', text: '', active: false, directions: ['slight left'] },
                      { type: 'lane', text: '', active: false, directions: ['slight right'] },
                      { type: 'lane', text: '', active: true, directions: ['slight right'], active_direction: 'slight right' },
                    ],
                  },
                },
              ],
              voiceInstructions: [{ distanceAlongGeometry: 142, announcement: 'Keep right to take exit 2307. Then Keep right to take E23.' }],
            },
            {
              distance: 226,
              duration: 16,
              name: '',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take exit 2307 onto E23 toward E1/E11.', location: L(101.65875, 3.13449) },
              intersections: [
                {
                  location: L(101.65875, 3.13449),
                  classes: ['motorway'],
                  lanes: [
                    { active: false, valid: false, indications: ['slight left'] },
                    { active: false, valid: false, indications: ['slight left'] },
                    { active: false, valid: false, indications: ['slight right'] },
                    { active: true, valid: true, indications: ['slight right'], valid_indication: 'slight right' },
                  ],
                },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 226,
                  primary: { text: 'E23', type: 'fork', modifier: 'right' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: false, directions: ['left'] },
                      { type: 'lane', text: '', active: false, directions: ['straight'] },
                      { type: 'lane', text: '', active: true, directions: ['straight'], active_direction: 'straight' },
                    ],
                  },
                },
              ],
              voiceInstructions: [{ distanceAlongGeometry: 140, announcement: 'Keep right to take E23.' }],
            },
            {
              distance: 625,
              duration: 43,
              name: '',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take E23 toward E1/E11.', location: L(101.65702, 3.13548) },
              intersections: [
                {
                  location: L(101.65702, 3.13548),
                  classes: ['motorway'],
                  lanes: [
                    { active: false, valid: false, indications: ['left'] },
                    { active: false, valid: false, indications: ['straight'] },
                    { active: true, valid: true, indications: ['straight'], valid_indication: 'straight' },
                  ],
                },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 625,
                  primary: { text: 'E23 / Damansara Link', type: 'fork', modifier: 'right' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: false, directions: ['left'] },
                      { type: 'lane', text: '', active: true, directions: ['straight'], active_direction: 'straight' },
                    ],
                  },
                },
              ],
              voiceInstructions: [{ distanceAlongGeometry: 140, announcement: 'Keep right to take E23.' }],
            },
            {
              distance: 1221,
              duration: 73,
              name: 'Damansara Link',
              ref: 'E23',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: 'Keep right to take E23/Damansara Link toward E1/E11/Ipoh/Kepong.', location: L(101.652, 3.13364) },
              intersections: [
                {
                  location: L(101.652, 3.13364),
                  classes: ['motorway'],
                  lanes: [
                    { active: false, valid: false, indications: ['left'] },
                    { active: true, valid: true, indications: ['straight'], valid_indication: 'straight' },
                  ],
                },
              ],
              bannerInstructions: [],
              voiceInstructions: [],
            },
            {
              distance: 2850,
              duration: 160, // excerpt: not captured (estimated from 2.85 km at ~64 km/h)
              name: 'Damansara Link',
              ref: 'E23',
              maneuver: { type: 'fork', modifier: 'slight right', instruction: '', location: L(101.64358, 3.12836) }, // instruction not captured
              intersections: [
                { location: L(101.64358, 3.12836), classes: ['motorway'] },
                {
                  location: L(101.63876, 3.1307),
                  classes: ['toll', 'motorway'],
                  toll_collection: { type: 'toll_booth', name: 'Plaza Tol Damansara (B)' },
                },
              ],
              bannerInstructions: [
                {
                  distanceAlongGeometry: 400,
                  primary: { type: 'off ramp', modifier: 'slight left' },
                  sub: {
                    text: '',
                    components: [
                      { type: 'lane', text: '', active: false, directions: ['slight left'] },
                      { type: 'lane', text: '', active: true, directions: ['slight left'], active_direction: 'slight left' },
                      { type: 'lane', text: '', active: false, directions: ['straight'] },
                      { type: 'lane', text: '', active: false, directions: ['straight'] },
                    ],
                  },
                },
              ],
              voiceInstructions: [],
            },
            {
              distance: 0,
              duration: 0,
              name: '',
              maneuver: { type: 'arrive', instruction: 'You have arrived.', location: L(101.6195, 3.13232) },
              intersections: [{ location: L(101.6195, 3.13232) }],
              bannerInstructions: [],
              voiceInstructions: [],
            },
          ],
        },
      ],
    },
  ],
};
