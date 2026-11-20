import type { LngLat } from '../config/malaysia';

const EARTH_RADIUS_M = 6371008.8;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Straight-line distance between two points on Earth, in metres. */
export function distanceMeters(a: LngLat, b: LngLat): number {
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(s));
}

/** Compass direction from a to b (0 = north, 90 = east). */
export function bearingDegrees(a: LngLat, b: LngLat): number {
  const p1 = toRad(a[1]);
  const p2 = toRad(b[1]);
  const dl = toRad(b[0] - a[0]);
  const y = Math.sin(dl) * Math.cos(p2);
  const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** A line with pre-computed distances so we can quickly find "the point 1.2 km along". */
export type MeasuredLine = {
  coords: LngLat[];
  /** cumulative[i] = distance from the start to coords[i], in metres */
  cumulative: number[];
  length: number;
};

export function measureLine(coords: LngLat[]): MeasuredLine {
  const cumulative = [0];
  for (let i = 1; i < coords.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceMeters(coords[i - 1], coords[i]));
  }
  return { coords, cumulative, length: cumulative[cumulative.length - 1] ?? 0 };
}

/** The point that is `distance` metres along the line. */
export function pointAlong(line: MeasuredLine, distance: number): LngLat {
  const { coords, cumulative } = line;
  if (distance <= 0) return coords[0];
  if (distance >= line.length) return coords[coords.length - 1];

  // Binary search for the segment that contains this distance.
  let lo = 0;
  let hi = cumulative.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cumulative[mid] <= distance) lo = mid;
    else hi = mid;
  }
  const segLen = cumulative[hi] - cumulative[lo] || 1;
  const t = (distance - cumulative[lo]) / segLen;
  const [x1, y1] = coords[lo];
  const [x2, y2] = coords[hi];
  return [x1 + (x2 - x1) * t, y1 + (y2 - y1) * t];
}

/** Smoothly turn from one angle towards another, taking the short way round. */
export function lerpAngle(from: number, to: number, t: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  return (from + diff * t + 360) % 360;
}

export type Snap = {
  /** Closest point on the line */
  point: LngLat;
  /** Distance from the start of the line to that point, in metres */
  along: number;
  /** How far the original point is from the line (sideways), in metres */
  offset: number;
};

/**
 * Finds the closest point on the route to a GPS reading ("snapping"), so the car is drawn
 * on the road even when GPS is a few metres off. Uses a flat-earth approximation, which is
 * accurate to centimetres over the short distances involved.
 */
export function snapToLine(line: MeasuredLine, p: LngLat): Snap {
  const { coords, cumulative } = line;
  const kx = 111320 * Math.cos(toRad(p[1])); // metres per degree of longitude here
  const ky = 110540; // metres per degree of latitude
  let best: Snap = { point: coords[0], along: 0, offset: Infinity };
  for (let i = 0; i < coords.length - 1; i++) {
    const ax = (coords[i][0] - p[0]) * kx;
    const ay = (coords[i][1] - p[1]) * ky;
    const bx = (coords[i + 1][0] - p[0]) * kx;
    const by = (coords[i + 1][1] - p[1]) * ky;
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
    const cx = ax + t * dx;
    const cy = ay + t * dy;
    const d = Math.hypot(cx, cy);
    if (d < best.offset) {
      best = {
        point: [p[0] + cx / kx, p[1] + cy / ky],
        along: cumulative[i] + t * (cumulative[i + 1] - cumulative[i]),
        offset: d,
      };
    }
  }
  return best;
}

/** Direction of the route at a given distance along it. */
export function bearingAlong(line: MeasuredLine, along: number): number {
  const a = pointAlong(line, Math.max(0, along - 5));
  const b = pointAlong(line, Math.min(line.length, along + 20));
  return bearingDegrees(a, b);
}

// ---------------- Lane ribbon helpers (flat local metres) ----------------

/** A point in local metres: x = east, y = north. */
export type XY = [number, number];

/** Flat projection around an origin - accurate to centimetres over a few km. */
export type LocalProjection = { toXY: (p: LngLat) => XY; toLngLat: (p: XY) => LngLat };

export function localProjection(origin: LngLat): LocalProjection {
  const kx = 111320 * Math.cos(toRad(origin[1]));
  const ky = 110574;
  return {
    toXY: (p) => [(p[0] - origin[0]) * kx, (p[1] - origin[1]) * ky],
    toLngLat: ([x, y]) => [origin[0] + x / kx, origin[1] + y / ky],
  };
}

/** Points every `step` metres along a polyline (keeps both ends). */
export function resampleXY(points: XY[], step: number): XY[] {
  if (points.length < 2) return points.slice();
  const out: XY[] = [points[0]];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    let d = step - carry;
    while (d <= len) {
      const t = d / len;
      out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
      d += step;
    }
    carry = len - (d - step);
  }
  const last = points[points.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last[0] - tail[0], last[1] - tail[1]) > step * 0.25) out.push(last);
  return out;
}

/** Moving-average smoothing (ends stay fixed) - rounds off kinks before offsetting. */
export function smoothXY(points: XY[], radius: number): XY[] {
  if (points.length < 3 || radius < 1) return points.slice();
  return points.map((p, i) => {
    if (i === 0 || i === points.length - 1) return p;
    const r = Math.min(radius, i, points.length - 1 - i);
    let sx = 0;
    let sy = 0;
    for (let k = i - r; k <= i + r; k++) {
      sx += points[k][0];
      sy += points[k][1];
    }
    return [sx / (2 * r + 1), sy / (2 * r + 1)];
  });
}

/** Unit normal pointing to the RIGHT of travel at each point (averaged over neighbours). */
export function rightNormals(points: XY[]): XY[] {
  return points.map((_, i) => {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(points.length - 1, i + 1)];
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [dy / len, -dx / len]; // rotate the direction 90° clockwise
  });
}

/**
 * Offsets a line sideways by `offsetAt(i)` metres (positive = right of travel).
 * Uses averaged normals on a resampled + smoothed line, so sharp bends give a clean curve
 * instead of miter spikes; inner-side points that would fold back are pulled in.
 */
export function offsetXY(points: XY[], normals: XY[], offsetAt: (i: number) => number): XY[] {
  const out = points.map(([x, y], i) => {
    const o = offsetAt(i);
    return [x + normals[i][0] * o, y + normals[i][1] * o] as XY;
  });
  // Remove fold-backs on the inside of tight bends: a point that moves backwards along
  // the travel direction is replaced by its predecessor.
  for (let i = 1; i < out.length - 1; i++) {
    const [cx, cy] = points[i];
    const [nx, ny] = points[i + 1];
    const dirX = nx - cx;
    const dirY = ny - cy;
    const stepX = out[i][0] - out[i - 1][0];
    const stepY = out[i][1] - out[i - 1][1];
    if (stepX * dirX + stepY * dirY < 0) out[i] = out[i - 1];
  }
  return out;
}

/** Smooth 0->1 ease (S-curve), used for lane changes. */
export function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}
