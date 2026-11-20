import type { Feature, FeatureCollection, LineString, Point, Polygon } from 'geojson';
import type { LngLat } from '../config/malaysia';
import type { NavRoute } from '../models/route';
import {
  localProjection,
  pointAlong,
  resampleXY,
  rightNormals,
  smoothXY,
  smoothstep,
  snapToLine,
  offsetXY,
  type MeasuredLine,
  type XY,
} from '../utils/geo';
import type { Lane, LaneIndication } from './laneGuidance';

/*
 * LANE RIBBON - a stylised lane-level road drawn on the map from the route centre line.
 *
 * Mapbox Standard has no real lane geometry, so this is a GUIDANCE VIEW, not surveyed lanes:
 * the route line is treated as the middle of the carriageway and lanes (3.5 m each) are laid
 * out on both sides of it.
 *
 * Lane order convention (same as Mapbox and the top lane banner): lanes are numbered LEFT TO
 * RIGHT as seen by the driver. Malaysia drives on the left, so lane 0 is the leftmost (kerb /
 * slow) lane and the last lane is the rightmost (fast) lane. Offsets are in metres from the
 * centre line, positive = to the RIGHT of the direction of travel.
 */

export const LANE_WIDTH_M = 3.5;
const BIN_M = 10; // lane-count resolution along the route
const TAPER_M = 100; // an added / dropped lane fades in or out over this distance
const APPROACH_M = 150; // Mapbox junction lane counts apply to this stretch before the junction
const SWITCH_START_M = 300; // the guide path starts moving to the target lane this far before a junction...
const SWITCH_END_M = 100; // ...and is fully in it this far before (S-curve over ~200 m)
const RECENTRE_M = 150; // after a junction the guide eases back to a middle lane over this distance
const SAMPLE_M = 3; // ribbon resolution (also the dash length)
const DASH_M = 3;
const DASH_PERIOD_M = 9; // 3 m dash + 6 m gap

/** Lane count (and optionally painted arrows) at a point along the route, from OSM or Mapbox. */
export type LaneSample = { along: number; count: number; source: 'mapbox' | 'osm' };

/** Where the guide path must be at a junction. */
export type GuideTarget = {
  /** Distance along the route of the junction */
  along: number;
  /** Offset (m, + right) of the target lane centre */
  offset: number;
  /** All recommended lane indexes at the junction, and the lane count there */
  recommended: number[];
  count: number;
  /** Lanes at the junction (for painted arrows) */
  lanes: Lane[];
  /** -1 = maneuver to the left, +1 = right, 0 = straight */
  side: -1 | 0 | 1;
  /** The maneuver leaves the road (exit / fork): the other lanes are drawn carrying on */
  peel: boolean;
};

export type LaneProfile = {
  length: number;
  /** Effective (possibly fractional, while tapering) number of lanes at a distance along the route */
  countAt: (along: number) => number;
  /** Guide path offset in metres (+ = right) at a distance along the route */
  guideOffsetAt: (along: number) => number;
  targets: GuideTarget[];
};

/** Offset of the centre of lane `index` on a road with `count` lanes (lane 0 = leftmost). */
export function laneCentreOffset(index: number, count: number): number {
  return -(count * LANE_WIDTH_M) / 2 + (index + 0.5) * LANE_WIDTH_M;
}

/** Index of the lane at a given offset on a road with `count` lanes. */
export function laneAtOffset(offset: number, count: number): number {
  const n = Math.max(1, Math.round(count));
  return Math.min(n - 1, Math.max(0, Math.floor((offset + (n * LANE_WIDTH_M) / 2) / LANE_WIDTH_M)));
}

/** A middle lane to rest in between junctions (left-of-centre on even counts: keep left). */
function restingOffset(count: number): number {
  const n = Math.max(1, Math.round(count));
  return laneCentreOffset(n % 2 ? (n - 1) / 2 : n / 2 - 1, n);
}

/** Default lanes per direction when nothing better is known (Mapbox only tells us "motorway"). */
function defaultCount(step: NavRoute['steps'][number]): number {
  if (step.highway) return 3;
  if (step.ref) return 2; // numbered federal / state road
  return 1;
}

/**
 * Builds the lane profile for a route. Lane counts, in order of priority:
 *  (a) Mapbox junction lanes, (b) OpenStreetMap lane tags, (c) a default by road class.
 */
export function buildLaneProfile(route: NavRoute, line: MeasuredLine, stepEnds: number[], osm: LaneSample[] = []): LaneProfile {
  const bins = Math.max(1, Math.ceil(line.length / BIN_M) + 1);
  const counts = new Array<number>(bins).fill(1);

  // (c) default by road class, per step
  let start = 0;
  route.steps.forEach((step, i) => {
    const end = stepEnds[i] ?? line.length;
    for (let b = Math.floor(start / BIN_M); b <= Math.min(bins - 1, Math.floor(end / BIN_M)); b++) counts[b] = defaultCount(step);
    start = end;
  });
  // (b) OpenStreetMap samples cover +-25 m around themselves
  for (const s of osm) {
    for (let b = Math.floor((s.along - 25) / BIN_M); b <= Math.floor((s.along + 25) / BIN_M); b++) {
      if (b >= 0 && b < bins) counts[b] = s.count;
    }
  }
  // (a) Mapbox junction lanes apply to the approach to the junction
  for (const j of route.laneJunctions) {
    const snap = snapToLine(line, j.location);
    if (snap.offset > 25) continue;
    for (let b = Math.floor((snap.along - APPROACH_M) / BIN_M); b <= Math.floor(snap.along / BIN_M); b++) {
      if (b >= 0 && b < bins) counts[b] = j.lanes.length;
    }
  }

  // Taper: wherever the whole-number count changes, ramp smoothly over TAPER_M.
  const tapered = counts.map((c) => c);
  for (let b = 1; b < bins; b++) {
    if (counts[b] === counts[b - 1]) continue;
    const at = b * BIN_M;
    const from = counts[b - 1];
    const to = counts[b];
    for (let k = Math.floor((at - TAPER_M / 2) / BIN_M); k <= Math.ceil((at + TAPER_M / 2) / BIN_M); k++) {
      if (k < 0 || k >= bins) continue;
      tapered[k] = from + (to - from) * smoothstep((k * BIN_M - (at - TAPER_M / 2)) / TAPER_M);
    }
  }
  const countAt = (along: number): number => {
    const x = Math.min(Math.max(along / BIN_M, 0), bins - 1);
    const i = Math.floor(x);
    const t = x - i;
    return tapered[i] * (1 - t) + tapered[Math.min(bins - 1, i + 1)] * t;
  };

  // Guide targets: the recommended lane for each junction that has lane data.
  const targets: GuideTarget[] = [];
  let previous = restingOffset(countAt(0));
  route.steps.forEach((step, i) => {
    const lanes = step.lanes;
    const next = route.steps[i + 1]?.maneuver;
    if (!lanes || !next) return;
    const recommended = lanes.flatMap((l, k) => (l.recommended ? [k] : []));
    if (recommended.length === 0) return;
    const count = lanes.length;
    // Of the recommended lanes, take the one nearest to where the guide already is (fewest lane changes).
    const best = recommended.reduce((a, b) =>
      Math.abs(laneCentreOffset(b, count) - previous) < Math.abs(laneCentreOffset(a, count) - previous) ? b : a,
    );
    const mod = next.modifier ?? '';
    const side: -1 | 0 | 1 = mod.includes('left') ? -1 : mod.includes('right') ? 1 : 0;
    const offset = laneCentreOffset(best, count);
    // Junction position: the maneuver point snapped onto the line (falls back to the step end).
    const snapped = snapToLine(line, next.location);
    targets.push({
      along: snapped.offset < 30 ? snapped.along : stepEnds[i],
      offset,
      recommended,
      count,
      lanes,
      side,
      peel: (next.type === 'off ramp' || next.type === 'fork') && recommended.length < count,
    });
    previous = offset;
  });

  // Guide offset key points: hold -> S-curve into the target lane -> hold -> recentre.
  type Key = { along: number; offset: number };
  const keys: Key[] = [{ along: 0, offset: restingOffset(countAt(0)) }];
  let lastEnd = 0;
  for (const t of targets) {
    const s = Math.max(lastEnd + 20, t.along - SWITCH_START_M);
    const e = Math.max(s + 40, t.along - SWITCH_END_M);
    keys.push({ along: s, offset: keys[keys.length - 1].offset }, { along: Math.min(e, t.along), offset: t.offset });
    keys.push({ along: t.along + 20, offset: t.offset });
    keys.push({ along: t.along + 20 + RECENTRE_M, offset: restingOffset(countAt(t.along + 20 + RECENTRE_M)) });
    lastEnd = t.along + 20 + RECENTRE_M;
  }
  keys.sort((a, b) => a.along - b.along);
  const guideOffsetAt = (along: number): number => {
    let raw = keys[keys.length - 1].offset;
    for (let i = 1; i < keys.length; i++) {
      if (along <= keys[i].along) {
        const a = keys[i - 1];
        const b = keys[i];
        const t = b.along > a.along ? (along - a.along) / (b.along - a.along) : 1;
        raw = a.offset + (b.offset - a.offset) * smoothstep(t);
        break;
      }
    }
    // Never leave the road.
    const half = (countAt(along) * LANE_WIDTH_M) / 2;
    const limit = Math.max(0, half - LANE_WIDTH_M / 2);
    return Math.min(limit, Math.max(-limit, raw));
  };

  return { length: line.length, countAt, guideOffsetAt, targets };
}

// ---------------- Geometry ----------------

export type RibbonKind = 'surface' | 'recommended' | 'divider' | 'edge' | 'guide' | 'arrow';
export type RibbonProps = { kind: RibbonKind; icon?: string; bearing?: number };
export type RibbonFeature = Feature<Polygon | LineString | Point, RibbonProps>;
export type Ribbon = FeatureCollection<Polygon | LineString | Point, RibbonProps>;

/** Painted-arrow icon name for a lane's indications (see laneRibbonLayers for the images). */
export function arrowIconFor(ind: LaneIndication[]): string {
  const has = (x: string) => ind.some((i) => i === x);
  const hasSide = (s: 'left' | 'right') => ind.some((i) => i === s || i === `sharp ${s}`);
  if (has('uturn')) return 'uturn';
  if (has('straight') && hasSide('left')) return 'straight-left';
  if (has('straight') && hasSide('right')) return 'straight-right';
  if (has('slight left')) return 'slight-left';
  if (has('slight right')) return 'slight-right';
  if (hasSide('left')) return 'left';
  if (hasSide('right')) return 'right';
  return 'straight';
}

const feature = (geometry: RibbonFeature['geometry'], props: RibbonProps): RibbonFeature => ({ type: 'Feature', geometry, properties: props });

/**
 * Lane ribbon geometry for the part of the route between `from` and `to` metres.
 * Returns an empty collection if the slice is too short.
 */
export function buildRibbon(profile: LaneProfile, line: MeasuredLine, from: number, to: number): Ribbon {
  const a0 = Math.max(0, from);
  const a1 = Math.min(line.length, to);
  if (a1 - a0 < SAMPLE_M * 3) return { type: 'FeatureCollection', features: [] };

  // 1. Centre line: sample, project to metres, smooth (no kinks -> no spikes when offset).
  const origin = pointAlong(line, a0);
  const proj = localProjection(origin);
  const raw: XY[] = [];
  for (let a = a0; a <= a1; a += SAMPLE_M) raw.push(proj.toXY(pointAlong(line, a)));
  // Light smoothing (+-9 m): rounds kinks without cutting real corners by more than ~3 m.
  const centre = smoothXY(resampleXY(raw, SAMPLE_M), 3);
  const along = centre.map((_, i) => a0 + i * SAMPLE_M);
  const normals = rightNormals(centre);
  const counts = along.map(profile.countAt);
  const widths = counts.map((c) => c * LANE_WIDTH_M);
  const guide = along.map(profile.guideOffsetAt);
  const toLL = (pts: XY[]): LngLat[] => pts.map(proj.toLngLat);
  const features: RibbonFeature[] = [];

  // 2. Road surface (with a small shoulder) and solid edge lines.
  const leftEdge = offsetXY(centre, normals, (i) => -widths[i] / 2);
  const rightEdge = offsetXY(centre, normals, (i) => widths[i] / 2);
  const leftShoulder = offsetXY(centre, normals, (i) => -widths[i] / 2 - 0.4);
  const rightShoulder = offsetXY(centre, normals, (i) => widths[i] / 2 + 0.4);
  const ring = toLL([...leftShoulder, ...rightShoulder.slice().reverse(), leftShoulder[0]]);
  features.push(feature({ type: 'Polygon', coordinates: [ring] }, { kind: 'surface' }));
  features.push(feature({ type: 'LineString', coordinates: toLL(leftEdge) }, { kind: 'edge' }));
  features.push(feature({ type: 'LineString', coordinates: toLL(rightEdge) }, { kind: 'edge' }));

  // 3. Recommended lane: a lane-wide band that follows the guide path (so it curves with it),
  //    plus every recommended lane in the last 400 m before a junction.
  const band = (offsets: number[], halfWidth: number, i0 = 0, i1 = centre.length - 1) => {
    const l = offsetXY(centre, normals, (i) => offsets[i] - halfWidth).slice(i0, i1 + 1);
    const r = offsetXY(centre, normals, (i) => offsets[i] + halfWidth).slice(i0, i1 + 1);
    if (l.length < 2) return;
    features.push(feature({ type: 'Polygon', coordinates: [toLL([...l, ...r.slice().reverse(), l[0]])] }, { kind: 'recommended' }));
  };
  band(guide, LANE_WIDTH_M / 2 - 0.15);
  for (const t of profile.targets) {
    const i0 = Math.max(0, Math.ceil((t.along - 400 - a0) / SAMPLE_M));
    const i1 = Math.min(centre.length - 1, Math.floor((t.along - a0) / SAMPLE_M));
    if (i1 - i0 < 2) continue;
    for (const k of t.recommended) {
      const offs = along.map(() => laneCentreOffset(k, t.count));
      // Only where the road really has that many lanes (not while tapering).
      if (Math.abs(counts[i1] - t.count) > 0.1) continue;
      band(offs, LANE_WIDTH_M / 2 - 0.15, i0, i1);
    }
  }

  // 4. Dashed lane dividers (3 m dash, 6 m gap), anchored to the route so they don't "swim".
  const maxLanes = Math.ceil(Math.max(...counts));
  for (let k = 1; k < maxLanes; k++) {
    const offset = (i: number) => -widths[i] / 2 + k * LANE_WIDTH_M;
    const pts = offsetXY(centre, normals, offset);
    for (let i = 0; i < pts.length - 1; i++) {
      const inRoad = offset(i) < widths[i] / 2 - 0.6 && offset(i + 1) < widths[i + 1] / 2 - 0.6;
      if (!inRoad || ((along[i] % DASH_PERIOD_M) + DASH_PERIOD_M) % DASH_PERIOD_M >= DASH_M) continue;
      features.push(feature({ type: 'LineString', coordinates: toLL([pts[i], pts[i + 1]]) }, { kind: 'divider' }));
    }
  }

  // 5. Guide path down the middle of the recommended lane.
  features.push(feature({ type: 'LineString', coordinates: toLL(offsetXY(centre, normals, (i) => guide[i])) }, { kind: 'guide' }));

  // 6. Painted arrows in each lane, ~40 m and ~90 m before each junction with lane data.
  for (const t of profile.targets) {
    for (const before of [40, 90]) {
      const a = t.along - before;
      if (a < a0 || a > a1) continue;
      const i = Math.round((a - a0) / SAMPLE_M);
      if (i <= 0 || i >= centre.length - 1 || Math.abs(counts[i] - t.count) > 0.1) continue;
      const [dx, dy] = [centre[i + 1][0] - centre[i - 1][0], centre[i + 1][1] - centre[i - 1][1]];
      const bearing = (Math.atan2(dx, dy) * 180) / Math.PI;
      t.lanes.forEach((lane, k) => {
        const o = laneCentreOffset(k, t.count);
        const p: XY = [centre[i][0] + normals[i][0] * o, centre[i][1] + normals[i][1] * o];
        features.push(feature({ type: 'Point', coordinates: proj.toLngLat(p) }, { kind: 'arrow', icon: arrowIconFor(lane.indications), bearing }));
      });
    }
  }

  // 7. Exits / forks: the lanes you are NOT taking carry straight on for a short way, so the
  //    chosen lane is seen peeling away from the main road.
  for (const t of profile.targets) {
    if (!t.peel || t.along < a0 || t.along > a1) continue;
    const i = Math.round((t.along - a0) / SAMPLE_M);
    const j = Math.max(0, i - 8);
    if (i <= 0 || i >= centre.length) continue;
    const dx = centre[i][0] - centre[j][0];
    const dy = centre[i][1] - centre[j][1];
    const len = Math.hypot(dx, dy) || 1;
    const dir: XY = [dx / len, dy / len];
    const nrm: XY = [dir[1], -dir[0]];
    const others = t.lanes.flatMap((l, k) => (l.recommended ? [] : [k]));
    const lo = Math.min(...others);
    const hi = Math.max(...others);
    const left = laneCentreOffset(lo, t.count) - LANE_WIDTH_M / 2;
    const right = laneCentreOffset(hi, t.count) + LANE_WIDTH_M / 2;
    const at = (o: number, d: number): XY => [centre[i][0] + nrm[0] * o + dir[0] * d, centre[i][1] + nrm[1] * o + dir[1] * d];
    const stub = [at(left - 0.4, 0), at(left - 0.4, 120), at(right + 0.4, 120), at(right + 0.4, 0), at(left - 0.4, 0)];
    features.push(feature({ type: 'Polygon', coordinates: [toLL(stub)] }, { kind: 'surface' }));
    features.push(feature({ type: 'LineString', coordinates: toLL([at(left, 0), at(left, 120)]) }, { kind: 'edge' }));
    features.push(feature({ type: 'LineString', coordinates: toLL([at(right, 0), at(right, 120)]) }, { kind: 'edge' }));
    for (let k = lo + 1; k <= hi; k++) {
      const o = laneCentreOffset(k, t.count) - LANE_WIDTH_M / 2;
      for (let d = 0; d < 120; d += DASH_PERIOD_M) {
        features.push(feature({ type: 'LineString', coordinates: toLL([at(o, d), at(o, d + DASH_M)]) }, { kind: 'divider' }));
      }
    }
  }

  return { type: 'FeatureCollection', features };
}

/** Moves a point sideways by `offset` metres (+ right) for a heading in degrees. */
export function offsetPoint(p: LngLat, bearingDeg: number, offset: number): LngLat {
  if (offset === 0) return p;
  const b = ((bearingDeg + 90) * Math.PI) / 180; // right of travel
  const kx = 111320 * Math.cos((p[1] * Math.PI) / 180);
  return [p[0] + (Math.sin(b) * offset) / kx, p[1] + (Math.cos(b) * offset) / 110574];
}
