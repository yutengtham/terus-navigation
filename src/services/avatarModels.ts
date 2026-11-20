// Builds each avatar preset as a .glb in the browser from simple shapes (original Terus designs).
// Conventions match the existing car: metres, +Y up, facing +X, roughly car-sized (~4.4 m long).

import { presetFor, type AvatarAccessory, type AvatarBody, type AvatarChoice } from '../config/avatars';
import { MeshBuilder, type Vec3 } from '../utils/mesh3d';
import { writeGlb, type MaterialSpec } from './glbWriter';

type Anchors = { top: Vec3; face: Vec3; antenna: Vec3; /** accessory size multiplier */ acc: number };

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function wheel(b: MeshBuilder, x: number, z: number, r = 0.34, w = 0.26): void {
  b.cylinder('tyre', [x, r, z], r, w, 'z', 10);
  b.cylinder('metal', [x, r, z + Math.sign(z) * (w / 2 + 0.01)], r * 0.45, 0.03, 'z', 8);
}

function fourWheels(b: MeshBuilder, x: number, z: number, r = 0.34): void {
  for (const sx of [1, -1]) for (const sz of [1, -1]) wheel(b, sx * x, sz * z, r);
}

function hatchback(b: MeshBuilder): Anchors {
  b.box('main', [0, 0.66, 0], [4.0, 0.62, 1.75]);
  b.taperedBox('main', [-0.35, 1.22, 0], [2.6, 0.6, 1.6], [0.55, 0.2, 0.12]);
  const c: Vec3 = [-0.35, 1.22, 0];
  for (const s of [1, -1]) {
    b.box('glass', [-0.4, 1.24, s * 0.77], [1.9, 0.34, 0.04]);
    // windscreen and rear window, just outside the sloped cabin faces
    b.quad('glass', [0.97, 0.95, s * 0.7], [0.97, 0.95, 0], [0.43, 1.5, 0], [0.43, 1.5, s * 0.62], c);
    b.quad('glass', [-1.67, 0.95, s * 0.7], [-1.67, 0.95, 0], [-1.47, 1.5, 0], [-1.47, 1.5, s * 0.62], c);
    b.box('light', [2.0, 0.74, s * 0.6], [0.06, 0.14, 0.34]);
    b.box('tail', [-2.0, 0.78, s * 0.62], [0.06, 0.14, 0.3]);
    b.box('accent', [0, 0.64, s * 0.885], [3.3, 0.1, 0.02]);
  }
  b.box('accent', [2.02, 0.45, 0], [0.08, 0.16, 1.6]);
  fourWheels(b, 1.35, 0.8);
  return { top: [-0.45, 1.52, 0], face: [0.72, 1.24, 0], antenna: [-1.3, 1.5, 0.5], acc: 1.6 };
}

function kapcai(b: MeshBuilder): Anchors {
  for (const x of [1.3, -1.3]) {
    b.cylinder('tyre', [x, 0.6, 0], 0.6, 0.22, 'z', 12);
    b.cylinder('metal', [x, 0.6, 0], 0.3, 0.26, 'z', 8);
  }
  b.box('main', [0.1, 1.0, 0], [1.8, 0.5, 0.45]);
  b.taperedBox('accent', [1.15, 1.25, 0], [0.4, 0.95, 0.62], [0.1, 0.0, 0.1]);
  b.box('dark', [-0.45, 1.36, 0], [1.25, 0.16, 0.46]);
  b.box('main', [-1.1, 1.22, 0], [0.75, 0.32, 0.42]);
  b.box('metal', [1.3, 1.8, 0], [0.1, 0.08, 1.05]);
  b.box('metal', [1.3, 1.2, 0], [0.08, 1.2, 0.08]);
  b.box('light', [1.38, 1.58, 0], [0.08, 0.2, 0.3]);
  b.box('tail', [-1.48, 1.25, 0], [0.06, 0.12, 0.26]);
  // rider
  b.box('rider', [-0.25, 2.0, 0], [0.5, 0.85, 0.55]);
  b.ellipsoid('main', [-0.05, 2.68, 0], [0.33, 0.33, 0.33], 5, 9);
  b.box('shades', [0.25, 2.66, 0], [0.06, 0.14, 0.4]);
  for (const s of [1, -1]) {
    b.box('rider', [0.55, 1.95, s * 0.32], [1.3, 0.14, 0.14]);
    b.box('rider', [0.1, 1.45, s * 0.3], [0.9, 0.18, 0.18]);
  }
  return { top: [-0.05, 3.0, 0], face: [0.27, 2.7, 0], antenna: [-1.25, 1.38, 0.15], acc: 1 };
}

function lorry(b: MeshBuilder): Anchors {
  const cab: Vec3 = [1.45, 1.3, 0];
  b.box('main', cab, [1.3, 1.9, 1.9]);
  b.quad('glass', [2.11, 1.45, -0.8], [2.11, 1.45, 0.8], [2.11, 2.05, 0.8], [2.11, 2.05, -0.8], cab);
  b.box('accent', [-0.7, 1.6, 0], [2.9, 2.2, 2.0]);
  b.box('dark', [0, 0.55, 0], [4.3, 0.3, 1.7]);
  for (const s of [1, -1]) {
    b.box('glass', [1.55, 1.75, s * 0.96], [0.8, 0.5, 0.03]);
    b.box('light', [2.12, 0.75, s * 0.7], [0.05, 0.18, 0.32]);
    b.box('tail', [-2.16, 0.8, s * 0.75], [0.05, 0.16, 0.26]);
    for (const x of [1.5, -0.5, -1.4]) wheel(b, x, s * 0.82, 0.45, 0.3);
  }
  return { top: [1.45, 2.25, 0], face: [2.13, 1.75, 0], antenna: [1.0, 2.25, 0.7], acc: 1.8 };
}

function durian(b: MeshBuilder): Anchors {
  const c: Vec3 = [0, 1.55, 0];
  const r: Vec3 = [1.7, 1.25, 1.25];
  b.ellipsoid('main', c, r, 6, 10);
  for (let i = 1; i < 6; i++) {
    for (let j = 0; j < 10; j++) {
      const th = (i / 6) * Math.PI;
      const ph = ((j + (i % 2) * 0.5) / 10) * Math.PI * 2;
      const n: Vec3 = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
      if (n[1] < -0.55) continue; // no spikes underneath (wheels)
      const base: Vec3 = [c[0] + r[0] * n[0] * 0.97, c[1] + r[1] * n[1] * 0.97, c[2] + r[2] * n[2] * 0.97];
      b.cone('spike', base, n, 0.17, 0.42, 5);
    }
  }
  b.cylinder('stem', [0, 2.95, 0], 0.08, 0.5, 'y', 6);
  b.ellipsoid('accent', [1.5, 1.65, 0], [0.38, 0.55, 0.62], 5, 8); // a peek at the golden flesh
  b.box('dark', [0, 0.42, 0], [2.6, 0.18, 1.7]);
  fourWheels(b, 1.1, 0.95, 0.35);
  return { top: [0, 2.85, 0], face: [1.75, 2.0, 0], antenna: [-0.9, 2.55, 0.5], acc: 1.3 };
}

/** Cat and tiger share a body; the tiger adds stripes. */
function feline(b: MeshBuilder, tiger: boolean): Anchors {
  const bodyC: Vec3 = [-0.3, 1.25, 0];
  b.ellipsoid('main', bodyC, [1.5, 0.75, 0.75], 6, 12);
  b.ellipsoid(tiger ? 'white' : 'accent', [-0.2, 1.02, 0], [1.25, 0.52, 0.62], 5, 10);
  if (tiger) {
    for (const x of [-1.3, -0.8, -0.3, 0.2, 0.7]) {
      const k = (x - bodyC[0]) / 1.5;
      const rr = 0.75 * Math.sqrt(Math.max(0, 1 - k * k)) + 0.025;
      b.ellipsoid('accent', [x, 1.25 + rr * 0.15, 0], [0.08, rr * 0.9, rr], 4, 10);
    }
  }
  const head: Vec3 = [1.45, 2.0, 0];
  b.ellipsoid('main', head, [0.7, 0.62, 0.66], 6, 10);
  b.ellipsoid(tiger ? 'white' : 'accent', [2.0, 1.85, 0], [0.26, 0.2, 0.32], 4, 8);
  b.ellipsoid('pink', [2.24, 1.96, 0], [0.07, 0.06, 0.08], 3, 6);
  if (tiger) {
    b.box('accent', [1.6, 2.55, 0], [0.12, 0.1, 0.5]);
    b.box('accent', [1.35, 2.58, 0], [0.12, 0.1, 0.45]);
  }
  for (const s of [1, -1]) {
    b.ellipsoid('dark', [1.98, 2.16, s * 0.27], [0.08, 0.11, 0.1], 3, 6);
    if (tiger) b.ellipsoid('main', [1.3, 2.52, s * 0.42], [0.14, 0.2, 0.18], 4, 6);
    else {
      b.cone('main', [1.42, 2.42, s * 0.38], [0, 1, s * 0.25], 0.22, 0.45, 5);
      b.cone('pink', [1.48, 2.45, s * 0.36], [0.05, 1, s * 0.25], 0.12, 0.3, 5);
    }
    for (const x of [0.6, -1.2]) {
      b.cylinder('main', [x, 0.45, s * 0.42], 0.2, 0.9, 'y', 8);
      b.ellipsoid(tiger ? 'white' : 'accent', [x + 0.05, 0.08, s * 0.42], [0.24, 0.1, 0.22], 3, 8);
    }
  }
  for (let k = 0; k < 6; k++) {
    const t = k / 5;
    const p: Vec3 = [-1.75 - t * 0.55, 1.4 + t * 1.1 - t * t * 0.2, 0];
    b.ellipsoid(tiger && k % 2 ? 'accent' : 'main', p, [0.17, 0.17, 0.17], 3, 6);
  }
  return { top: [1.45, 2.62, 0], face: [2.05, 2.16, 0], antenna: [-2.3, 2.5, 0], acc: 1 };
}

function tapir(b: MeshBuilder): Anchors {
  b.ellipsoid('main', [-0.2, 1.3, 0], [1.7, 0.85, 0.8], 6, 12);
  b.ellipsoid('accent', [-0.6, 1.36, 0], [0.95, 0.9, 0.85], 6, 12); // the white "saddle"
  b.ellipsoid('main', [1.55, 1.45, 0], [0.62, 0.52, 0.5], 5, 10);
  b.ellipsoid('main', [2.15, 1.28, 0], [0.38, 0.2, 0.22], 4, 8);
  for (const s of [1, -1]) {
    b.ellipsoid('main', [1.35, 1.98, s * 0.3], [0.12, 0.18, 0.1], 3, 6);
    b.ellipsoid('accent', [1.35, 2.13, s * 0.3], [0.08, 0.06, 0.07], 3, 6);
    b.ellipsoid('dark', [1.95, 1.58, s * 0.3], [0.06, 0.07, 0.07], 3, 6);
    for (const x of [1.0, -1.3]) b.cylinder('main', [x, 0.42, s * 0.42], 0.22, 0.85, 'y', 8);
  }
  return { top: [1.5, 1.97, 0], face: [2.0, 1.6, 0], antenna: [-1.5, 2.05, 0.3], acc: 1 };
}

function tehtarik(b: MeshBuilder): Anchors {
  b.cylinder('main', [0, 1.5, 0], 1.1, 2.0, 'y', 14);
  b.cylinder('accent', [0, 2.49, 0], 1.03, 0.04, 'y', 14);
  b.ellipsoid('foam', [0, 2.53, 0], [0.95, 0.12, 0.95], 4, 12);
  b.box('main', [-1.32, 2.0, 0], [0.5, 0.15, 0.2]);
  b.box('main', [-1.32, 1.0, 0], [0.5, 0.15, 0.2]);
  b.box('main', [-1.55, 1.5, 0], [0.15, 1.15, 0.2]);
  b.box('accent', [0.2, 1.5, 0], [2.0, 0.5, 2.24]); // a band of tea showing through
  for (const s of [1, -1]) b.ellipsoid('dark', [1.12, 1.95, s * 0.3], [0.05, 0.1, 0.09], 3, 6);
  b.box('dark', [0, 0.45, 0], [2.4, 0.2, 1.8]);
  fourWheels(b, 0.9, 0.95, 0.33);
  return { top: [0, 2.62, 0], face: [1.12, 1.95, 0], antenna: [-0.6, 2.6, 0.6], acc: 1.4 };
}

const BODIES: Record<Exclude<AvatarBody, 'car'>, (b: MeshBuilder) => Anchors> = {
  hatchback,
  kapcai,
  lorry,
  durian,
  cat: (b) => feline(b, false),
  tiger: (b) => feline(b, true),
  tapir,
  tehtarik,
};

function accessory(b: MeshBuilder, kind: AvatarAccessory, a: Anchors): void {
  if (kind === 'none') return;
  const anchor = kind === 'sunglasses' ? a.face : kind === 'flag' ? a.antenna : a.top;
  b.transform = (p) => [anchor[0] + (p[0] - anchor[0]) * a.acc, anchor[1] + (p[1] - anchor[1]) * a.acc, anchor[2] + (p[2] - anchor[2]) * a.acc];
  if (kind === 'cap') {
    b.ellipsoid('capmat', add(a.top, [0, -0.02, 0]), [0.42, 0.3, 0.42], 4, 10);
    b.box('capmat', add(a.top, [0.45, -0.02, 0]), [0.46, 0.05, 0.6]);
  } else if (kind === 'sunglasses') {
    for (const s of [1, -1]) b.box('shades', add(a.face, [0.06, 0, s * 0.2]), [0.06, 0.18, 0.3]);
    b.box('shades', add(a.face, [0.06, 0.04, 0]), [0.05, 0.05, 0.14]);
  } else if (kind === 'flag') {
    b.cylinder('metal', add(a.antenna, [0, 0.6, 0]), 0.03, 1.2, 'y', 6);
    b.box('capmat', add(a.antenna, [-0.27, 1.02, 0]), [0.52, 0.34, 0.03]);
  } else if (kind === 'crown') {
    b.cylinder('gold', add(a.top, [0, 0.1, 0]), 0.32, 0.2, 'y', 10);
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2;
      b.cone('gold', add(a.top, [Math.cos(ang) * 0.26, 0.19, Math.sin(ang) * 0.26]), [0, 1, 0], 0.08, 0.26, 4);
      b.ellipsoid('gem', add(a.top, [Math.cos(ang) * 0.32, 0.1, Math.sin(ang) * 0.32]), [0.04, 0.04, 0.04], 2, 4);
    }
  }
  b.transform = null;
}

/** Darker version of a "#rrggbb" colour (durian spikes). */
function shade(hex: string, f: number): string {
  const n = parseInt(hex.replace('#', ''), 16) || 0;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

export function materialsFor(main: string, accent: string): Record<string, MaterialSpec> {
  return {
    main: { color: main, roughness: 0.5 },
    accent: { color: accent, roughness: 0.55 },
    capmat: { color: accent, roughness: 0.7 },
    spike: { color: shade(main, 0.72), roughness: 0.8 },
    dark: { color: '#1d2430', roughness: 0.7 },
    tyre: { color: '#15171c', roughness: 0.9 },
    metal: { color: '#b4bac2', metallic: 0.6, roughness: 0.35 },
    glass: { color: '#2a3b52', metallic: 0.2, roughness: 0.15 },
    light: { color: '#fff7d6', emissive: '#fff2b0' },
    tail: { color: '#e5484d', emissive: '#a01010' },
    pink: { color: '#f59ab5', roughness: 0.6 },
    white: { color: '#f7f7f5', roughness: 0.6 },
    gold: { color: '#f2c230', metallic: 0.6, roughness: 0.3 },
    gem: { color: '#e5484d', emissive: '#6a0a0a' },
    shades: { color: '#101418', metallic: 0.3, roughness: 0.2 },
    stem: { color: '#6b4a2b', roughness: 0.8 },
    foam: { color: '#f3e3c3', roughness: 0.9 },
    rider: { color: '#2b3a55', roughness: 0.8 },
  };
}

/** The mesh for one choice (no file I/O) - also used by the dev checks. */
export function buildAvatarMesh(choice: Pick<AvatarChoice, 'body' | 'accessory'>): MeshBuilder | null {
  if (choice.body === 'car' || choice.body === 'upload') return null;
  const b = new MeshBuilder();
  const anchors = BODIES[choice.body](b);
  accessory(b, choice.accessory, anchors);
  return b;
}

export function buildAvatarGlb(choice: AvatarChoice): ArrayBuffer | null {
  const mesh = buildAvatarMesh(choice);
  return mesh ? writeGlb(mesh.parts, materialsFor(choice.main, choice.accent)) : null;
}

/** Map scale for a body (uploads are pre-scaled to car length, so they use the car's 2.5x). */
export function avatarScale(body: AvatarChoice['body']): number {
  return body === 'upload' ? 2.5 : presetFor(body).scale;
}
