// Writes a glTF 2.0 binary (.glb) from flat-shaded mesh parts, entirely in the browser.
// Used for avatars, so colours / accessories can be changed without any server or files.

import type { MeshParts } from '../utils/mesh3d';

export type MaterialSpec = {
  /** sRGB colour as "#rrggbb" */
  color: string;
  metallic?: number;
  roughness?: number;
  /** Glowing parts (lights) - sRGB "#rrggbb" */
  emissive?: string;
};

/** "#rrggbb" (sRGB) -> linear RGB 0..1, which glTF expects. */
export function hexToLinear(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  const n = m ? parseInt(m[1], 16) : 0x888888;
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  return c.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)) as [number, number, number];
}

const pad4 = (n: number) => (4 - (n % 4)) % 4;

export function writeGlb(parts: MeshParts, materials: Record<string, MaterialSpec>): ArrayBuffer {
  const names = [...parts.keys()].filter((k) => (parts.get(k)?.positions.length ?? 0) > 0);
  const chunks: (Float32Array | Uint16Array | Uint32Array | Uint8Array)[] = [];
  const bufferViews: object[] = [];
  const accessors: object[] = [];
  const primitives: object[] = [];
  const mats: object[] = [];
  let offset = 0;

  names.forEach((name, i) => {
    const { positions, normals } = parts.get(name)!;
    const pos = new Float32Array(positions);
    const nor = new Float32Array(normals);
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let k = 0; k < pos.length; k += 3) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], pos[k + a]);
        max[a] = Math.max(max[a], pos[k + a]);
      }
    }
    for (const [arr, isPos] of [
      [pos, true],
      [nor, false],
    ] as const) {
      bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: arr.byteLength, target: 34962 });
      accessors.push({
        bufferView: bufferViews.length - 1,
        componentType: 5126,
        count: arr.length / 3,
        type: 'VEC3',
        ...(isPos ? { min, max } : {}),
      });
      chunks.push(arr);
      offset += arr.byteLength;
    }
    // Mapbox's model loader needs indexed triangles (like the original car.glb).
    const count = pos.length / 3;
    const idx = count <= 65535 ? new Uint16Array(count) : new Uint32Array(count);
    for (let k = 0; k < count; k++) idx[k] = k;
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: idx.byteLength, target: 34963 });
    accessors.push({ bufferView: bufferViews.length - 1, componentType: count <= 65535 ? 5123 : 5125, count, type: 'SCALAR' });
    chunks.push(idx);
    offset += idx.byteLength;
    const gap = pad4(offset);
    if (gap) {
      chunks.push(new Uint8Array(gap)); // keep the next float data 4-byte aligned
      offset += gap;
    }
    const spec = materials[name] ?? { color: '#888888' };
    mats.push({
      name,
      pbrMetallicRoughness: {
        baseColorFactor: [...hexToLinear(spec.color), 1],
        metallicFactor: spec.metallic ?? 0,
        roughnessFactor: spec.roughness ?? 0.6,
      },
      ...(spec.emissive ? { emissiveFactor: hexToLinear(spec.emissive) } : {}),
    });
    primitives.push({ attributes: { POSITION: i * 3, NORMAL: i * 3 + 1 }, indices: i * 3 + 2, material: i });
  });

  const json = {
    asset: { version: '2.0', generator: 'Terus avatar builder' },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: 'avatar' }],
    meshes: [{ primitives }],
    materials: mats,
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };
  const jsonBytes = new TextEncoder().encode(JSON.stringify(json));
  const jsonLen = jsonBytes.length + pad4(jsonBytes.length);
  const binLen = offset + pad4(offset);
  const total = 12 + 8 + jsonLen + 8 + binLen;
  const out = new ArrayBuffer(total);
  const view = new DataView(out);
  const bytes = new Uint8Array(out);
  view.setUint32(0, 0x46546c67, true); // "glTF"
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLen, true);
  view.setUint32(16, 0x4e4f534a, true); // "JSON"
  bytes.set(jsonBytes, 20);
  bytes.fill(0x20, 20 + jsonBytes.length, 20 + jsonLen); // pad JSON with spaces
  const binStart = 20 + jsonLen;
  view.setUint32(binStart, binLen, true);
  view.setUint32(binStart + 4, 0x004e4942, true); // "BIN"
  let o = binStart + 8;
  for (const c of chunks) {
    bytes.set(new Uint8Array(c.buffer, c.byteOffset, c.byteLength), o);
    o += c.byteLength;
  }
  return out;
}
