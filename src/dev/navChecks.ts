import { laneVoiceCue, spokenDistance } from '../i18n/navStrings';
import { routesFromResponse } from '../services/directionsService';
import { describeRecommended, lanesAreInformative, lanesFromIntersection } from '../services/laneGuidance';
import { routeLineLength } from './navCheckHelpers';
import { placeTolls, shortPlazaName, upcomingTolls } from '../services/tollAhead';
import { measureLine, snapToLine } from '../utils/geo';
import type { LngLat } from '../config/malaysia';
import { buildLaneProfile, buildRibbon, laneCentreOffset, LANE_WIDTH_M, type LaneProfile } from '../services/laneRibbon';
import { prepareRoute } from '../services/routeProgress';
import { SAMPLE_DIRECTIONS } from './sampleDirections';

/*
 * Checks for the lane parser and the toll-distance maths, run against a saved real Mapbox
 * response (sampleDirections.ts). Shown on the dev check page (open the app with ?navcheck=1)
 * and runnable from a terminal: npx tsx src/dev/runNavChecks.ts
 */

export type CheckResult = { name: string; pass: boolean; detail: string };

export function runNavChecks(): CheckResult[] {
  const results: CheckResult[] = [];
  const check = (name: string, pass: boolean, detail = '') => results.push({ name, pass, detail });

  const routes = routesFromResponse(SAMPLE_DIRECTIONS);
  const route = routes[0];
  check('Sample parses into 1 route with 8 steps', routes.length === 1 && route.steps.length === 8, `${routes.length} route(s), ${route?.steps.length} steps`);

  // --- Lanes from banners ---
  const kerinchi = route.steps[1].lanes;
  check(
    'Kerinchi Link exit: 4 lanes, right two recommended (nearest banner)',
    JSON.stringify(kerinchi?.map((l) => l.recommended)) === '[false,false,true,true]',
    JSON.stringify(kerinchi),
  );
  check('Recommended lane follows "slight right"', kerinchi?.[3]?.preferredIndication === 'slight right', String(kerinchi?.[3]?.preferredIndication));
  check('Lane row is shown for it (informative)', lanesAreInformative(kerinchi));
  check('All-lanes-OK junction is NOT shown (nothing to choose)', !lanesAreInformative(route.steps[0].lanes), JSON.stringify(route.steps[0].lanes));
  check('No lane data -> null, never invented', route.steps[5].lanes === null, JSON.stringify(route.steps[5].lanes));
  const pos = kerinchi ? describeRecommended(kerinchi) : null;
  check('Recommended lanes described as "two right lanes"', pos?.side === 'right' && pos.count === 2, JSON.stringify(pos));
  const leftExit = route.steps[6].lanes;
  check('Damansara exit: second lane from left', JSON.stringify(leftExit?.map((l) => l.recommended)) === '[false,true,false,false]', JSON.stringify(leftExit?.map((l) => l.recommended)));

  // --- Lanes from intersections (fallback) ---
  const fromJunction = lanesFromIntersection([
    { active: false, valid: false, indications: ['left'] },
    { active: false, valid: false, indications: ['straight'] },
    { active: true, valid: true, indications: ['straight'], valid_indication: 'straight' },
  ]);
  check('Intersection lanes fallback: only the right lane recommended', JSON.stringify(fromJunction?.map((l) => l.recommended)) === '[false,false,true]');
  check('Empty intersection lanes -> null', lanesFromIntersection([]) === null && lanesFromIntersection(undefined) === null);

  // --- Highway flag ---
  check('Highway flag from route number (E23) and motorway class', route.steps[1].highway && route.steps[3].highway, `${route.steps[1].highway}, ${route.steps[3].highway}`);

  // --- Voice cue in 3 languages ---
  const cue = (lang: 'en' | 'ms' | 'zh') =>
    laneVoiceCue({ meters: 1000, maneuver: route.steps[2].maneuver, lanes: pos!, totalLanes: 4, towards: 'Kerinchi Link', lang });
  check('Voice cue EN', cue('en') === 'In 1 kilometre, keep right, use the two right lanes, towards Kerinchi Link.', cue('en'));
  check('Voice cue BM', cue('ms') === 'Dalam 1 kilometer, ikut kanan, guna dua lorong kanan, menuju Kerinchi Link.', cue('ms'));
  check('Voice cue 中文', cue('zh') === '1公里后靠右行驶，请走右侧两条车道，前往 Kerinchi Link。', cue('zh'));
  check('Spoken distance rounding', spokenDistance(1500, 'en') === 'In 1.5 kilometres' && spokenDistance(430, 'en') === 'In 400 metres', `${spokenDistance(1500, 'en')} / ${spokenDistance(430, 'en')}`);

  // --- Tolls ---
  const line = measureLine(route.coordinates);
  const tolls = placeTolls(line, route.tollPlazas);
  check('Two toll plazas found, in route order', tolls.length === 2 && tolls[0].along < tolls[1].along, tolls.map((t) => `${t.name} @ ${Math.round(t.along)} m`).join(', '));
  check('Pantai priced RM2.50, Damansara RM2.00 (SPRINT, verified table)', tolls[0]?.rate?.rm === 2.5 && tolls[1]?.rate?.rm === 2.0, tolls.map((t) => t.rate?.rm ?? 'not priced').join(', '));
  const toPantai = routeLineLength(route.coordinates.slice(0, 4));
  check('Distance to Pantai = length of the line up to the plaza', Math.abs(tolls[0].along - toPantai) < 1, `${Math.round(tolls[0].along)} vs ${Math.round(toPantai)} m`);
  const atStart = upcomingTolls(tolls, 0);
  check('At the start: next = Pantai, after = Damansara', atStart[0]?.name === 'Plaza Tol Pantai (B)' && atStart[1]?.name === 'Plaza Tol Damansara (B)');
  const mid = upcomingTolls(tolls, tolls[0].along - 600);
  check('600 m before Pantai: distance counts down to 600 m', Math.round(mid[0].distance) === 600, `${Math.round(mid[0].distance)} m`);
  const after = upcomingTolls(tolls, tolls[0].along + 30);
  check('After passing Pantai: moves on to Damansara', after.length === 1 && after[0].name === 'Plaza Tol Damansara (B)', after.map((t) => t.name).join(', '));
  check('No tolls left at the end', upcomingTolls(tolls, line.length).length === 0);
  check('Short plaza name', shortPlazaName('Plaza Tol Pantai (B)') === 'Pantai' && shortPlazaName('Plaza Tol Gombak (Arah Timur)') === 'Gombak');

  // --- Lane ribbon (map lane view) ---
  const prepared = prepareRoute(route);
  const profile = buildLaneProfile(route, prepared.line, prepared.stepEnds);
  // The 4-lane split after Kerinchi Link (the next maneuver point, on the route line).
  const kerinchiJunction = snapToLine(prepared.line, route.steps[2].maneuver.location).along;
  check('Lane count before the Kerinchi split = 4 (Mapbox junction lanes)', Math.round(profile.countAt(kerinchiJunction - 50)) === 4, profile.countAt(kerinchiJunction - 50).toFixed(2));
  let maxStep = 0;
  for (let a = 10; a < prepared.line.length; a += 10) maxStep = Math.max(maxStep, Math.abs(profile.countAt(a) - profile.countAt(a - 10)));
  check('Lane count changes taper (no jump bigger than ~0.3 lane per 10 m)', maxStep <= 0.35, `max change ${maxStep.toFixed(2)} lanes / 10 m`);
  check(
    'Left-hand traffic order: lane 0 is leftmost (negative offset), last lane rightmost',
    laneCentreOffset(0, 4) === -1.5 * LANE_WIDTH_M && laneCentreOffset(3, 4) === 1.5 * LANE_WIDTH_M,
    `${laneCentreOffset(0, 4)} / ${laneCentreOffset(3, 4)}`,
  );
  const target = profile.targets.find((t) => Math.abs(t.along - kerinchiJunction) < 1);
  check('Kerinchi split target is a right-hand lane (exit on the right)', !!target && target.offset > 0 && target.recommended.join() === '2,3', JSON.stringify(target && { offset: target.offset, rec: target.recommended }));
  // S-curve: smooth, monotonic move from the previous lane to the target lane before the junction.
  const curve: number[] = [];
  for (let a = kerinchiJunction - 320; a <= kerinchiJunction - 90; a += 3) curve.push(profile.guideOffsetAt(a));
  const deltas = curve.slice(1).map((v, i) => v - curve[i]);
  const monotonic = deltas.every((d) => d >= -1e-6) || deltas.every((d) => d <= 1e-6);
  const maxSlope = Math.max(...deltas.map(Math.abs)) / 3;
  check('Guide path changes lane with a smooth S-curve (monotonic, gentle)', monotonic && maxSlope < 0.06, `monotonic=${monotonic}, max ${maxSlope.toFixed(3)} m sideways per m`);
  check('Guide path is in the target lane before the junction', Math.abs(profile.guideOffsetAt(kerinchiJunction - 60) - (target?.offset ?? NaN)) < 0.01);
  // Sharp 90° bend: offset lines must not spike out.
  const bend: LngLat[] = [[101.7, 3.15], [101.7 + 200 / 111170, 3.15], [101.7 + 200 / 111170, 3.15 + 200 / 110574]];
  const bendLine = measureLine(bend);
  const flat: LaneProfile = { length: bendLine.length, countAt: () => 3, guideOffsetAt: () => 0, targets: [] };
  const ribbon = buildRibbon(flat, bendLine, 0, bendLine.length);
  const edgeLines = ribbon.features.flatMap((f) => (f.properties.kind === 'edge' && f.geometry.type === 'LineString' ? [f.geometry.coordinates] : []));
  const kx = 111170;
  const ky = 110574;
  let maxJump = 0;
  let foldBack = false;
  let maxOut = 0;
  for (const e of edgeLines) {
    for (let i = 1; i < e.length; i++) {
      const dx = (e[i][0] - e[i - 1][0]) * kx;
      const dy = (e[i][1] - e[i - 1][1]) * ky;
      maxJump = Math.max(maxJump, Math.hypot(dx, dy));
      // Travel goes east then north: an edge must never step back west or south.
      if (dx < -0.01 || dy < -0.01) foldBack = true;
    }
    for (const p of e) maxOut = Math.max(maxOut, snapToLine(bendLine, [p[0], p[1]]).offset);
  }
  check(
    'Sharp 90° bend: edges have no spikes, jumps or fold-backs',
    maxJump < 8 && !foldBack && maxOut <= (3 * LANE_WIDTH_M) / 2 + 3.5,
    `max step ${maxJump.toFixed(1)} m, fold-back=${foldBack}, furthest ${maxOut.toFixed(1)} m from the road centre`,
  );
  const kinds = new Set(buildRibbon(profile, prepared.line, kerinchiJunction - 400, kerinchiJunction + 200).features.map((f) => f.properties.kind));
  check('Ribbon near the split has every layer (surface, lane, dividers, edges, guide, arrows)', ['surface', 'recommended', 'divider', 'edge', 'guide', 'arrow'].every((k) => kinds.has(k as never)), [...kinds].join(', '));

  return results;
}
