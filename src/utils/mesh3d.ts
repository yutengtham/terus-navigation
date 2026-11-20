// Tiny low-poly mesh builder for Terus's own avatar models (same style as tools/make_car.py):
// metres, +Y up, the model faces +X. Flat-shaded triangles grouped by material name.

export type Vec3 = [number, number, number];

export type MeshParts = Map<string, { positions: number[]; normals: number[] }>;

const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rotation around the vertical (Y) axis, degrees; positive turns +X towards -Z (left). */
export function rotY(p: Vec3, deg: number, about: Vec3 = [0, 0, 0]): Vec3 {
  const r = (deg * Math.PI) / 180;
  const x = p[0] - about[0];
  const z = p[2] - about[2];
  return [about[0] + x * Math.cos(r) + z * Math.sin(r), p[1], about[2] - x * Math.sin(r) + z * Math.cos(r)];
}
/** Rotation around the Z axis (tilts +X up), degrees. */
export function rotZ(p: Vec3, deg: number, about: Vec3 = [0, 0, 0]): Vec3 {
  const r = (deg * Math.PI) / 180;
  const x = p[0] - about[0];
  const y = p[1] - about[1];
  return [about[0] + x * Math.cos(r) - y * Math.sin(r), about[1] + x * Math.sin(r) + y * Math.cos(r), p[2]];
}

export class MeshBuilder {
  readonly parts: MeshParts = new Map();
  /** Optional transform applied to every point added (used to place accessories). */
  transform: ((p: Vec3) => Vec3) | null = null;

  /** Adds a triangle facing away from `centre`, so every solid is lit from outside. */
  tri(mat: string, a: Vec3, b: Vec3, c: Vec3, centre: Vec3): void {
    if (this.transform) {
      a = this.transform(a);
      b = this.transform(b);
      c = this.transform(c);
      centre = this.transform(centre);
    }
    let n = cross(sub(b, a), sub(c, a));
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-12) return;
    n = [n[0] / len, n[1] / len, n[2] / len];
    const mid: Vec3 = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
    if (dot(n, sub(mid, centre)) < 0) {
      [b, c] = [c, b];
      n = [-n[0], -n[1], -n[2]];
    }
    let part = this.parts.get(mat);
    if (!part) {
      part = { positions: [], normals: [] };
      this.parts.set(mat, part);
    }
    part.positions.push(...a, ...b, ...c);
    part.normals.push(...n, ...n, ...n);
  }

  quad(mat: string, a: Vec3, b: Vec3, c: Vec3, d: Vec3, centre: Vec3): void {
    this.tri(mat, a, b, c, centre);
    this.tri(mat, a, c, d, centre);
  }

  /** Axis-aligned box (optionally turned around Y by `yaw` degrees), centre + full size. */
  box(mat: string, centre: Vec3, size: Vec3, yaw = 0): void {
    const [cx, cy, cz] = centre;
    const [sx, sy, sz] = size.map((v) => v / 2);
    const v = (x: number, y: number, z: number): Vec3 => rotY([cx + x * sx, cy + y * sy, cz + z * sz], yaw, centre);
    const p = [v(-1, -1, -1), v(1, -1, -1), v(1, 1, -1), v(-1, 1, -1), v(-1, -1, 1), v(1, -1, 1), v(1, 1, 1), v(-1, 1, 1)];
    const faces = [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [3, 2, 6, 7],
      [0, 3, 7, 4],
      [1, 2, 6, 5],
    ];
    for (const f of faces) this.quad(mat, p[f[0]], p[f[1]], p[f[2]], p[f[3]], centre);
  }

  /**
   * Box whose top face is smaller than its bottom (a car cabin): `topInset` shrinks the
   * top by [front, back, side] metres.
   */
  taperedBox(mat: string, centre: Vec3, size: Vec3, topInset: [number, number, number]): void {
    const [cx, cy, cz] = centre;
    const [hx, hy, hz] = size.map((v) => v / 2);
    const [front, back, side] = topInset;
    const b = [
      [cx - hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz - hz],
      [cx + hx, cy - hy, cz + hz],
      [cx - hx, cy - hy, cz + hz],
    ] as Vec3[];
    const t = [
      [cx - hx + back, cy + hy, cz - hz + side],
      [cx + hx - front, cy + hy, cz - hz + side],
      [cx + hx - front, cy + hy, cz + hz - side],
      [cx - hx + back, cy + hy, cz + hz - side],
    ] as Vec3[];
    this.quad(mat, b[0], b[1], b[2], b[3], centre);
    this.quad(mat, t[0], t[1], t[2], t[3], centre);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.quad(mat, b[i], b[j], t[j], t[i], centre);
    }
  }

  /** Cylinder along an axis ('x' front-back, 'y' up, 'z' sideways). */
  cylinder(mat: string, centre: Vec3, radius: number, length: number, axis: 'x' | 'y' | 'z', segments = 12, capMat = mat): void {
    const pt = (ang: number, along: number): Vec3 => {
      const a = Math.cos(ang) * radius;
      const b = Math.sin(ang) * radius;
      if (axis === 'x') return [centre[0] + along, centre[1] + a, centre[2] + b];
      if (axis === 'y') return [centre[0] + a, centre[1] + along, centre[2] + b];
      return [centre[0] + a, centre[1] + b, centre[2] + along];
    };
    const h = length / 2;
    const ai = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
    const capA: Vec3 = [...centre];
    const capB: Vec3 = [...centre];
    capA[ai] -= h;
    capB[ai] += h;
    for (let i = 0; i < segments; i++) {
      const a0 = (i / segments) * Math.PI * 2;
      const a1 = ((i + 1) / segments) * Math.PI * 2;
      this.quad(mat, pt(a0, -h), pt(a1, -h), pt(a1, h), pt(a0, h), centre);
      this.tri(capMat, capA, pt(a0, -h), pt(a1, -h), centre);
      this.tri(capMat, capB, pt(a0, h), pt(a1, h), centre);
    }
  }

  /** Low-poly ellipsoid (sphere when all radii are equal). */
  ellipsoid(mat: string, centre: Vec3, radii: Vec3, rings = 6, segments = 10): void {
    const pt = (i: number, j: number): Vec3 => {
      const th = (i / rings) * Math.PI;
      const ph = (j / segments) * Math.PI * 2;
      return [
        centre[0] + radii[0] * Math.sin(th) * Math.cos(ph),
        centre[1] + radii[1] * Math.cos(th),
        centre[2] + radii[2] * Math.sin(th) * Math.sin(ph),
      ];
    };
    for (let i = 0; i < rings; i++) {
      for (let j = 0; j < segments; j++) {
        const a = pt(i, j);
        const b = pt(i + 1, j);
        const c = pt(i + 1, j + 1);
        const d = pt(i, j + 1);
        if (i > 0) this.tri(mat, a, b, d, centre);
        if (i < rings - 1) this.tri(mat, b, c, d, centre);
      }
    }
  }

  /** Cone from a base centre pointing along `dir` (unit vector). */
  cone(mat: string, base: Vec3, dir: Vec3, radius: number, height: number, segments = 6): void {
    const d = dir.map((v) => v / Math.hypot(...dir)) as Vec3;
    const helper: Vec3 = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = cross(d, helper);
    const ul = Math.hypot(...u);
    u = u.map((v) => v / ul) as Vec3;
    const w = cross(d, u);
    const tip: Vec3 = [base[0] + d[0] * height, base[1] + d[1] * height, base[2] + d[2] * height];
    const centre: Vec3 = [base[0] + d[0] * height * 0.3, base[1] + d[1] * height * 0.3, base[2] + d[2] * height * 0.3];
    const ring = (k: number): Vec3 => {
      const a = (k / segments) * Math.PI * 2;
      return [
        base[0] + (u[0] * Math.cos(a) + w[0] * Math.sin(a)) * radius,
        base[1] + (u[1] * Math.cos(a) + w[1] * Math.sin(a)) * radius,
        base[2] + (u[2] * Math.cos(a) + w[2] * Math.sin(a)) * radius,
      ];
    };
    for (let k = 0; k < segments; k++) {
      this.tri(mat, ring(k), ring(k + 1), tip, centre);
      this.tri(mat, ring(k), ring(k + 1), base, centre);
    }
  }

  /** Total triangle count (for the performance budget). */
  triangleCount(): number {
    let n = 0;
    for (const p of this.parts.values()) n += p.positions.length / 9;
    return n;
  }
}
